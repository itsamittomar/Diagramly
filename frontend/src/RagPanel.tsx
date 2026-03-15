import { useState, useRef, useEffect } from "react";

interface Doc {
  id: string;
  name: string;
  size: number;
  chunkCount: number;
  uploadedAt: string;
}

interface Message {
  role: "user" | "assistant";
  text: string;
}

const API = "http://localhost:8080";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function RagPanel() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/api/rag/docs`)
      .then((r) => r.json())
      .then((data) => setDocs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const uploadFile = async (file: File) => {
    setUploadError("");
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "md", "csv", "pdf"].includes(ext ?? "")) {
      setUploadError("Supported formats: .txt, .md, .csv, .pdf");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/api/rag/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const msg = await res.text();
        setUploadError(msg || "Upload failed");
        return;
      }
      const doc: Doc = await res.json();
      setDocs((prev) => [doc, ...prev]);
      setSelectedDoc(doc);
      setMessages([]);
    } catch {
      setUploadError("Upload failed — is the server running?");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const selectDoc = (doc: Doc) => {
    setSelectedDoc(doc);
    setMessages([]);
    setQuestion("");
  };

  const sendQuestion = async () => {
    if (!question.trim() || !selectedDoc || querying) return;
    const q = question.trim();
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuerying(true);
    try {
      const res = await fetch(`${API}/api/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: selectedDoc.id, question: q }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.error ? `Error: ${data.error}` : data.answer },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Failed to get answer." }]);
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="rag-layout">
      {/* Left: document list */}
      <div className="rag-sidebar">
        <div className="rag-sidebar-header">Documents</div>

        {/* Upload zone */}
        <div
          className={`upload-zone ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.pdf"
            style={{ display: "none" }}
            onChange={handleFileInput}
          />
          {uploading ? (
            <div className="upload-zone-content">
              <div className="upload-spinner" />
              <span>Uploading…</span>
            </div>
          ) : (
            <div className="upload-zone-content">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Click or drop a file</span>
              <small>.txt · .md · .csv · .pdf</small>
            </div>
          )}
        </div>

        {uploadError && <div className="rag-upload-error">{uploadError}</div>}

        {/* Doc list */}
        <div className="doc-list">
          {docs.length === 0 && (
            <div className="doc-list-empty">No documents uploaded yet</div>
          )}
          {docs.map((doc) => (
            <div
              key={doc.id}
              className={`doc-item ${selectedDoc?.id === doc.id ? "active" : ""}`}
              onClick={() => selectDoc(doc)}
            >
              <div className="doc-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className="doc-info">
                <span className="doc-name">{doc.name}</span>
                <span className="doc-meta">{formatSize(doc.size)} · {doc.chunkCount} chunks</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: chat */}
      <div className="rag-chat">
        {!selectedDoc ? (
          <div className="rag-empty">
            <div className="empty-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <p className="empty-title">Select a document to start</p>
            <p className="empty-sub">Upload a file on the left, then ask questions about it</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {selectedDoc.name}
            </div>

            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-hint">
                  Ask anything about <strong>{selectedDoc.name}</strong>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`chat-bubble ${msg.role}`}>
                  {msg.role === "assistant" && (
                    <div className="bubble-avatar">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                      </svg>
                    </div>
                  )}
                  <div className="bubble-text">{msg.text}</div>
                </div>
              ))}
              {querying && (
                <div className="chat-bubble assistant">
                  <div className="bubble-avatar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                    </svg>
                  </div>
                  <div className="bubble-text typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-input-row">
              <textarea
                className="chat-input"
                placeholder="Ask a question about this document…"
                value={question}
                rows={1}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendQuestion();
                  }
                }}
              />
              <button
                className={`chat-send ${querying || !question.trim() ? "disabled" : ""}`}
                onClick={sendQuestion}
                disabled={querying || !question.trim()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
