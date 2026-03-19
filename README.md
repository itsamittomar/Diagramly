# Diagramly

A full-stack AI-powered developer tool for generating architecture diagrams, designing database schemas, and querying documents using RAG (Retrieval-Augmented Generation).

## Features

- **Architecture Diagrams** — Describe your system in plain English and get a Mermaid flowchart instantly
- **Schema Designer** — Visually build database schemas with tables, columns, types (PK/FK), and relationships rendered as ER diagrams
- **Document Q&A (RAG)** — Upload documents and ask questions; answers are grounded in the document content using vector search + LLM

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Mermaid.js |
| Backend | Go |
| LLM | Groq (Llama 3.3 70B) |
| Vector DB | Qdrant |
| Embeddings | Ollama (default) / Cohere / OpenAI |
| Deployment | Docker, Fly.io |

## Prerequisites

- Go 1.21+
- Node.js 20+
- [Groq API key](https://console.groq.com)
- [Qdrant](https://cloud.qdrant.io) instance (cloud or local)
- An embedding provider (one of):
  - [Ollama](https://ollama.com) running locally (default)
  - Cohere API key
  - OpenAI API key

## Local Development

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd awesomeProject10

# Backend
go mod download

# Frontend
cd frontend && npm install && cd ..
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
QDRANT_URL=https://your-cluster.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key

# Embedding provider: "ollama" (default), "cohere", or "openai"
EMBED_PROVIDER=ollama

# Required only if using the respective provider
COHERE_API_KEY=your_cohere_key
OPENAI_API_KEY=your_openai_key
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8080
```

### 3. Build the frontend

```bash
cd frontend
npm run build
cd ..
```

### 4. Run the backend

```bash
go run main.go embedder.go rag.go
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Frontend hot-reload (optional)

Run the frontend dev server separately while the backend is running:

```bash
cd frontend
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/diagram` | Generate Mermaid diagram from text |
| `POST` | `/api/rag/upload` | Upload a document for RAG |
| `GET` | `/api/rag/docs` | List uploaded documents |
| `POST` | `/api/rag/query` | Ask a question about a document |

### Example: Generate Diagram

```bash
curl -X POST http://localhost:8080/api/diagram \
  -H 'Content-Type: application/json' \
  -d '{"text": "A user sends a request to an API gateway which routes to a backend service that queries a PostgreSQL database"}'
```

### Example: Upload Document

```bash
curl -X POST http://localhost:8080/api/rag/upload \
  -F 'file=@document.pdf'
```

### Example: Query Document

```bash
curl -X POST http://localhost:8080/api/rag/query \
  -H 'Content-Type: application/json' \
  -d '{"docId": "your-doc-id", "question": "What is the main topic?"}'
```

Supported file types: `.txt`, `.md`, `.csv`, `.pdf` (max 32MB)

## Docker

Build and run with Docker:

```bash
docker build -t diagramly .
docker run -p 8080:8080 \
  -e GROQ_API_KEY=your_key \
  -e QDRANT_URL=your_url \
  -e QDRANT_API_KEY=your_key \
  diagramly
```

## Deployment on Fly.io

```bash
fly launch   # first time setup
fly deploy   # subsequent deploys
```

Set secrets on Fly.io:

```bash
fly secrets set GROQ_API_KEY=your_key
fly secrets set QDRANT_URL=your_url
fly secrets set QDRANT_API_KEY=your_key
fly secrets set EMBED_PROVIDER=cohere
fly secrets set COHERE_API_KEY=your_key
```

## Deployment on Render

If deploying frontend and backend as separate services, set `VITE_API_URL` as an environment variable in the **frontend service** on Render's dashboard to point to your backend URL:

```
VITE_API_URL=https://your-backend.onrender.com
```

> Vite bakes env vars into the bundle at build time, so this must be set in the Render dashboard — not just in `.env` locally.

## How RAG Works

1. Upload a document → text is extracted and split into 100-word chunks (10-word overlap)
2. Each chunk is embedded into a vector using the configured provider
3. Vectors are stored in Qdrant with document metadata
4. On query, the question is embedded and the top 5 most similar chunks are retrieved
5. Retrieved chunks are passed to Groq LLM to generate a grounded answer


## Live Version
https://diagramly.onrender.com/
