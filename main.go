package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
)

type DiagramRequest struct {
	Text string `json:"text"`
}

type DiagramResponse struct {
	Mermaid string `json:"mermaid"`
	Error   string `json:"error,omitempty"`
}

// Groq API types (OpenAI-compatible)
type groqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqRequest struct {
	Model    string        `json:"model"`
	Messages []groqMessage `json:"messages"`
}

type groqResponse struct {
	Choices []struct {
		Message groqMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

var groqAPIKey string

const systemPrompt = `You are an architecture diagram assistant.
Convert the user's description into a Mermaid flowchart diagram.

STRICT MERMAID SYNTAX RULES:
- First line must be: graph TD
- Every node MUST have an ID followed by a shape, e.g.: User([User])  NOT [User]
- Node formats:
    ServiceName[Label]       for services/components
    UserName([Label])        for users/external systems
    DBName[(Label)]          for databases
- Arrow format: NodeID1 -->|label| NodeID2   — NO trailing > after the closing pipe
- Node IDs must be alphanumeric, no spaces (use CamelCase)
- Correct example:
    graph LR
        User([User]) -->|HTTP POST| Webhook[Webhook Service]
        Webhook -->|stores| DB[(Database)]
- Return ONLY valid Mermaid syntax. No explanation, no markdown, no code fences.`

// callGroq sends a message to Groq with the given system prompt and returns the raw text response.
func callGroq(sysPrompt, userText string) (string, error) {
	body, _ := json.Marshal(groqRequest{
		Model: "llama-3.3-70b-versatile",
		Messages: []groqMessage{
			{Role: "system", Content: sysPrompt},
			{Role: "user", Content: userText},
		},
	})

	req, _ := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+groqAPIKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var groqResp groqResponse
	if err := json.Unmarshal(respBody, &groqResp); err != nil {
		return "", err
	}
	if groqResp.Error != nil {
		return "", fmt.Errorf("groq error: %s", groqResp.Error.Message)
	}
	if len(groqResp.Choices) == 0 {
		return "", fmt.Errorf("no response from groq")
	}
	return groqResp.Choices[0].Message.Content, nil
}

var (
	codeFenceRe     = regexp.MustCompile("(?i)```(?:mermaid)?\\s*([\\s\\S]*?)```")
	trailingArrowRe = regexp.MustCompile(`\|>(\s)`)
	bareNodeRe      = regexp.MustCompile(`(-->|<--|---|\s)\[([^\]]+)\]`)
	graphDirRe      = regexp.MustCompile(`(?i)^(graph|flowchart)\s+(LR|RL|BT)`)
)

func cleanMermaid(raw string) string {
	// Strip code fences
	if m := codeFenceRe.FindStringSubmatch(raw); len(m) > 1 {
		raw = m[1]
	}
	raw = strings.TrimSpace(raw)

	// Force vertical layout: replace graph LR/RL/BT → graph TD
	raw = graphDirRe.ReplaceAllString(raw, "$1 TD")

	// Fix -->|label|> NodeID  →  -->|label| NodeID
	raw = trailingArrowRe.ReplaceAllString(raw, `|$1`)

	// Fix bare [Label] nodes (no ID) → Label[Label]
	raw = bareNodeRe.ReplaceAllStringFunc(raw, func(match string) string {
		// Extract the label inside brackets
		inner := bareNodeRe.FindStringSubmatch(match)
		if len(inner) < 3 {
			return match
		}
		prefix := inner[1]
		label := inner[2]
		id := strings.ReplaceAll(label, " ", "")
		return prefix + id + "[" + label + "]"
	})

	return raw
}

func handleDiagram(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req DiagramRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Text == "" {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	raw, err := callGroq(systemPrompt, req.Text)
	if err != nil {
		log.Printf("Groq API error: %v", err)
		json.NewEncoder(w).Encode(DiagramResponse{Error: "failed to generate diagram"})
		return
	}

	log.Printf("CLEANED mermaid:\n%s", cleanMermaid(raw))
	json.NewEncoder(w).Encode(DiagramResponse{Mermaid: cleanMermaid(raw)})
}

func main() {
	groqAPIKey = os.Getenv("GROQ_API_KEY")
	if groqAPIKey == "" {
		log.Fatal("GROQ_API_KEY environment variable not set")
	}

	qdrantURL = os.Getenv("QDRANT_URL")
	qdrantAPIKey = os.Getenv("QDRANT_API_KEY")
	if qdrantURL == "" || qdrantAPIKey == "" {
		log.Fatal("QDRANT_URL and QDRANT_API_KEY environment variables not set")
	}

	if err := EnsureCollection(); err != nil {
		log.Fatalf("Qdrant init failed: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/diagram", handleDiagram)
	mux.HandleFunc("/api/rag/upload", handleRAGUpload)
	mux.HandleFunc("/api/rag/docs", handleRAGListDocs)
	mux.HandleFunc("/api/rag/query", handleRAGQuery)
	mux.Handle("/", http.FileServer(http.Dir("./frontend/dist")))

	handler := corsMiddleware(mux)

	fmt.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		next.ServeHTTP(w, r)
	})
}
