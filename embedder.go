package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// ── Interface ─────────────────────────────────────────────────────────────────

// Embedder converts text into a vector. Implement this interface to add
// a new embedding provider — then register it in main.go.
type Embedder interface {
	EmbedDocument(text string) ([]float64, error) // used when indexing chunks
	EmbedQuery(text string) ([]float64, error)    // used when searching (some providers differ)
	Dim() int                                     // vector dimension
	ProviderName() string
}

// activeEmbedder is set at startup based on EMBED_PROVIDER env var.
var activeEmbedder Embedder

// ── Ollama ────────────────────────────────────────────────────────────────────

type OllamaEmbedder struct {
	URL   string // default: http://localhost:11434
	Model string // default: nomic-embed-text
}

func (e *OllamaEmbedder) embed(text string) ([]float64, error) {
	body, _ := json.Marshal(map[string]string{"model": e.Model, "prompt": text})
	resp, err := http.Post(e.URL+"/api/embeddings", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ollama unreachable: %w", err)
	}
	defer resp.Body.Close()
	var result struct {
		Embedding []float64 `json:"embedding"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if len(result.Embedding) == 0 {
		return nil, fmt.Errorf("ollama returned empty embedding — is %q pulled?", e.Model)
	}
	return result.Embedding, nil
}

func (e *OllamaEmbedder) EmbedDocument(text string) ([]float64, error) { return e.embed(text) }
func (e *OllamaEmbedder) EmbedQuery(text string) ([]float64, error)    { return e.embed(text) }
func (e *OllamaEmbedder) Dim() int                                     { return 768 }
func (e *OllamaEmbedder) ProviderName() string                         { return "ollama" }

// ── Cohere ────────────────────────────────────────────────────────────────────

type CohereEmbedder struct {
	APIKey string
	Model  string // default: embed-english-v3.0
}

func (e *CohereEmbedder) embed(text, inputType string) ([]float64, error) {
	body, _ := json.Marshal(map[string]any{
		"texts":      []string{text},
		"model":      e.Model,
		"input_type": inputType,
	})
	req, _ := http.NewRequest("POST", "https://api.cohere.com/v1/embed", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+e.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cohere unreachable: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	var result struct {
		Embeddings [][]float64 `json:"embeddings"`
		Message    string      `json:"message"` // error field
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("cohere error: %s", result.Message)
	}
	if len(result.Embeddings) == 0 || len(result.Embeddings[0]) == 0 {
		return nil, fmt.Errorf("cohere returned empty embedding")
	}
	return result.Embeddings[0], nil
}

func (e *CohereEmbedder) EmbedDocument(text string) ([]float64, error) {
	return e.embed(text, "search_document")
}
func (e *CohereEmbedder) EmbedQuery(text string) ([]float64, error) {
	return e.embed(text, "search_query")
}
func (e *CohereEmbedder) Dim() int             { return 1024 }
func (e *CohereEmbedder) ProviderName() string { return "cohere" }

// ── OpenAI ────────────────────────────────────────────────────────────────────

type OpenAIEmbedder struct {
	APIKey string
	Model  string // default: text-embedding-3-small
}

func (e *OpenAIEmbedder) embed(text string) ([]float64, error) {
	body, _ := json.Marshal(map[string]string{"input": text, "model": e.Model})
	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/embeddings", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+e.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai unreachable: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	var result struct {
		Data []struct {
			Embedding []float64 `json:"embedding"`
		} `json:"data"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	if result.Error != nil {
		return nil, fmt.Errorf("openai error: %s", result.Error.Message)
	}
	if len(result.Data) == 0 || len(result.Data[0].Embedding) == 0 {
		return nil, fmt.Errorf("openai returned empty embedding")
	}
	return result.Data[0].Embedding, nil
}

func (e *OpenAIEmbedder) EmbedDocument(text string) ([]float64, error) { return e.embed(text) }
func (e *OpenAIEmbedder) EmbedQuery(text string) ([]float64, error)    { return e.embed(text) }
func (e *OpenAIEmbedder) Dim() int                                     { return 1536 }
func (e *OpenAIEmbedder) ProviderName() string                         { return "openai" }
