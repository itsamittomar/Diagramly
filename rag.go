package main

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/ledongthuc/pdf"
)

// ── Config (set from env in main.go) ─────────────────────────────────────────

var (
	qdrantURL    string // e.g. https://xyz.qdrant.io
	qdrantAPIKey string
)

const (
	chunkWords   = 100
	chunkOverlap = 10
	topKChunks   = 5
)

// qdrantCollection is per-provider so switching embedders doesn't break existing vectors.
func qdrantCollection() string {
	return "diagramly_" + activeEmbedder.ProviderName()
}

// ── In-memory document metadata ──────────────────────────────────────────────

type Document struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Size       int64     `json:"size"`
	ChunkCount int       `json:"chunkCount"`
	UploadedAt time.Time `json:"uploadedAt"`
}

var (
	docStore   = map[string]*Document{}
	docStoreMu sync.RWMutex
)

// ── PDF extraction ────────────────────────────────────────────────────────────

func extractPDFText(data []byte) (string, error) {
	// Write to a temp file — ledongthuc/pdf requires a file path
	tmp, err := os.CreateTemp("", "rag-*.pdf")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(data); err != nil {
		return "", err
	}
	tmp.Close()

	f, r, err := pdf.Open(tmp.Name())
	if err != nil {
		return "", fmt.Errorf("could not open PDF: %w", err)
	}
	defer f.Close()

	var sb strings.Builder
	for i := 1; i <= r.NumPage(); i++ {
		page := r.Page(i)
		if page.V.IsNull() {
			continue
		}
		text, err := page.GetPlainText(nil)
		if err != nil {
			continue
		}
		sb.WriteString(text)
		sb.WriteString("\n")
	}
	return sb.String(), nil
}

// ── Chunking ──────────────────────────────────────────────────────────────────

func chunkText(text string) []string {
	words := strings.Fields(text)
	var chunks []string
	for i := 0; i < len(words); {
		end := i + chunkWords
		if end > len(words) {
			end = len(words)
		}
		chunks = append(chunks, strings.Join(words[i:end], " "))
		if end == len(words) {
			break
		}
		i += chunkWords - chunkOverlap
	}
	return chunks
}

// ── Qdrant Cloud REST client ──────────────────────────────────────────────────

func qdrantDo(method, path string, payload any) ([]byte, int, error) {
	var body io.Reader
	if payload != nil {
		b, _ := json.Marshal(payload)
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, qdrantURL+path, body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", qdrantAPIKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return b, resp.StatusCode, nil
}

// EnsureCollection creates the Qdrant collection if it doesn't exist.
func EnsureCollection() error {
	_, status, err := qdrantDo("GET", "/collections/"+qdrantCollection(), nil)
	if err != nil {
		return err
	}
	if status == 200 {
		log.Printf("Qdrant: collection %q already exists", qdrantCollection())
		// Ensure index exists even on existing collection (idempotent)
		qdrantDo("PUT",
			"/collections/"+qdrantCollection()+"/index",
			map[string]any{"field_name": "doc_id", "field_schema": "keyword"},
		)
		return nil
	}
	_, status, err = qdrantDo("PUT", "/collections/"+qdrantCollection(), map[string]any{
		"vectors": map[string]any{
			"size":     activeEmbedder.Dim(),
			"distance": "Cosine",
		},
	})
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("failed to create collection, status %d", status)
	}
	log.Printf("Qdrant: created collection %q", qdrantCollection())

	// Create payload index on doc_id so filters work
	_, status, err = qdrantDo("PUT",
		"/collections/"+qdrantCollection()+"/index",
		map[string]any{"field_name": "doc_id", "field_schema": "keyword"},
	)
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("failed to create doc_id index, status %d", status)
	}
	log.Printf("Qdrant: created payload index on doc_id")
	return nil
}

type qdrantPoint struct {
	ID      string         `json:"id"`
	Vector  []float64      `json:"vector"`
	Payload map[string]any `json:"payload"`
}

func upsertPoints(points []qdrantPoint) error {
	_, status, err := qdrantDo("PUT",
		"/collections/"+qdrantCollection()+"/points",
		map[string]any{"points": points},
	)
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("qdrant upsert failed, status %d", status)
	}
	return nil
}

type qdrantSearchResult struct {
	Result []struct {
		Score   float64        `json:"score"`
		Payload map[string]any `json:"payload"`
	} `json:"result"`
}

func searchChunks(queryVec []float64, docID string) ([]string, error) {
	body := map[string]any{
		"vector": queryVec,
		"limit":  topKChunks,
		"filter": map[string]any{
			"must": []map[string]any{
				{"key": "doc_id", "match": map[string]any{"value": docID}},
			},
		},
		"with_payload": true,
	}
	raw, status, err := qdrantDo("POST",
		"/collections/"+qdrantCollection()+"/points/search", body)
	if err != nil {
		return nil, err
	}
	if status != 200 {
		return nil, fmt.Errorf("qdrant search failed, status %d: %s", status, string(raw))
	}
	var result qdrantSearchResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}

	// Sort by score descending (Qdrant usually returns sorted, but let's be safe)
	sort.Slice(result.Result, func(i, j int) bool {
		return result.Result[i].Score > result.Result[j].Score
	})

	chunks := make([]string, 0, len(result.Result))
	for _, r := range result.Result {
		if text, ok := r.Payload["text"].(string); ok {
			chunks = append(chunks, text)
		}
	}
	return chunks, nil
}

// ── UUID helper ───────────────────────────────────────────────────────────────

func newUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// ── HTTP Handlers ─────────────────────────────────────────────────────────────

func handleRAGUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "file too large (max 32MB)", http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file field required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".txt" && ext != ".md" && ext != ".csv" && ext != ".pdf" {
		http.Error(w, "unsupported file type — supported: .txt .md .csv .pdf", http.StatusBadRequest)
		return
	}

	raw, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "failed to read file", http.StatusInternalServerError)
		return
	}

	var content string
	if ext == ".pdf" {
		content, err = extractPDFText(raw)
		if err != nil {
			http.Error(w, "failed to extract PDF text: "+err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		content = string(raw)
	}

	chunks := chunkText(content)
	docID := fmt.Sprintf("%d", time.Now().UnixNano())

	// Embed each chunk and build Qdrant points
	log.Printf("RAG upload: embedding %d chunks for %q…", len(chunks), header.Filename)
	points := make([]qdrantPoint, 0, len(chunks))
	for i, chunk := range chunks {
		vec, err := activeEmbedder.EmbedDocument(chunk)
		if err != nil {
			http.Error(w, "embedding failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		points = append(points, qdrantPoint{
			ID:     newUUID(),
			Vector: vec,
			Payload: map[string]any{
				"doc_id":      docID,
				"chunk_index": i,
				"text":        chunk,
			},
		})
	}

	if err := upsertPoints(points); err != nil {
		http.Error(w, "qdrant upsert failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	doc := &Document{
		ID:         docID,
		Name:       header.Filename,
		Size:       header.Size,
		ChunkCount: len(chunks),
		UploadedAt: time.Now(),
	}
	docStoreMu.Lock()
	docStore[docID] = doc
	docStoreMu.Unlock()

	log.Printf("RAG: stored %d vectors for %q (doc %s)", len(chunks), doc.Name, docID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(doc)
}

func handleRAGListDocs(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	docStoreMu.RLock()
	list := make([]*Document, 0, len(docStore))
	for _, d := range docStore {
		list = append(list, d)
	}
	docStoreMu.RUnlock()

	sort.Slice(list, func(i, j int) bool {
		return list[i].UploadedAt.After(list[j].UploadedAt)
	})
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

type ragQueryRequest struct {
	DocID    string `json:"docId"`
	Question string `json:"question"`
}

type ragQueryResponse struct {
	Answer string `json:"answer"`
	Error  string `json:"error,omitempty"`
}

const ragSystemPrompt = `You are a document analysis assistant.
Answer the user's question using ONLY the provided document excerpts.
Be concise, accurate, and cite specific details from the text.
If the answer is not in the excerpts, say "I couldn't find that in the document."`

func handleRAGQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ragQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.DocID == "" || req.Question == "" {
		http.Error(w, "docId and question required", http.StatusBadRequest)
		return
	}

	docStoreMu.RLock()
	doc, ok := docStore[req.DocID]
	docStoreMu.RUnlock()
	if !ok {
		http.Error(w, "document not found", http.StatusNotFound)
		return
	}

	// Embed the question
	queryVec, err := activeEmbedder.EmbedQuery(req.Question)
	if err != nil {
		http.Error(w, "embedding failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Vector search in Qdrant
	topChunks, err := searchChunks(queryVec, req.DocID)
	if err != nil {
		http.Error(w, "qdrant search failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	context := strings.Join(topChunks, "\n\n---\n\n")
	userPrompt := fmt.Sprintf("Document: %s\n\nRelevant excerpts:\n%s\n\nQuestion: %s",
		doc.Name, context, req.Question)

	w.Header().Set("Content-Type", "application/json")
	log.Printf("RAG: retrieved %d chunks, calling Groq…", len(topChunks))
	answer, err := callGroq(ragSystemPrompt, userPrompt)
	if err != nil {
		log.Printf("RAG Groq error: %v", err)
		json.NewEncoder(w).Encode(ragQueryResponse{Error: "Groq failed: " + err.Error()})
		return
	}
	json.NewEncoder(w).Encode(ragQueryResponse{Answer: answer})
}
