import { useState, useEffect, useRef, useCallback } from "react";
import mermaid from "mermaid";
import SchemaPanel from "./SchemaPanel";
import RagPanel from "./RagPanel";
import "./App.css";

mermaid.initialize({ startOnLoad: false, theme: "neutral" });

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type Mode = "arch" | "schema" | "rag";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("arch");
  const [text, setText] = useState("");
  const [mermaidCode, setMermaidCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const diagramRef = useRef<HTMLDivElement>(null);
  const debouncedText = useDebounce(text, 800);

  const changeZoom = (delta: number) =>
    setZoom((z) => Math.min(3, Math.max(0.25, +(z + delta).toFixed(2))));

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      changeZoom(e.deltaY < 0 ? 0.1 : -0.1);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setMermaidCode("");
    setError("");
    setZoom(1);
  };

  const exportDiagram = (format: "png" | "svg") => {
    if (!diagramRef.current) return;
    const svgEl = diagramRef.current.querySelector("svg");
    if (!svgEl) return;

    const w = svgEl.viewBox.baseVal.width || svgEl.clientWidth || 800;
    const h = svgEl.viewBox.baseVal.height || svgEl.clientHeight || 600;

    if (format === "svg") {
      const clone = svgEl.cloneNode(true) as SVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = "diagram.svg";
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = "diagram.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  };

  const generateDiagram = useCallback(async (input: string) => {
    if (!input.trim()) { setMermaidCode(""); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/diagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setMermaidCode(data.mermaid);
    } catch {
      setError("Could not reach backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "arch") generateDiagram(debouncedText);
  }, [debouncedText, generateDiagram, mode]);

  useEffect(() => {
    if (!mermaidCode || !diagramRef.current) {
      if (diagramRef.current) diagramRef.current.innerHTML = "";
      return;
    }
    diagramRef.current.innerHTML = "";
    const id = `mermaid-${Date.now()}`;
    mermaid
      .render(id, mermaidCode)
      .then(({ svg }) => {
        if (diagramRef.current) diagramRef.current.innerHTML = svg;
      })
      .catch((e) => {
        console.error("Mermaid render error:", e);
        console.error("Failed mermaid code:\n", mermaidCode);
        setError("Mermaid render failed. Check console for raw syntax.");
      });
  }, [mermaidCode]);

  const archPlaceholder =
    "Describe your architecture...\n\nExamples:\n• We get a request from the customer\n• The API server queries the database\n• Auth service validates the token before routing";

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <div className="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          </div>
          <span className="brand-name">Diagramly</span>
        </div>

        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === "arch" ? "active" : ""}`}
            onClick={() => switchMode("arch")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            </svg>
            Architecture
          </button>
          <button
            className={`mode-btn ${mode === "schema" ? "active" : ""}`}
            onClick={() => switchMode("schema")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            Schema Design
          </button>
          <button
            className={`mode-btn ${mode === "rag" ? "active" : ""}`}
            onClick={() => switchMode("rag")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Documents
          </button>
        </div>

        <div className="header-right">
          {loading && (
            <div className="generating-pill">
              <span className="pulse-dot" />
              Generating…
            </div>
          )}
        </div>
      </header>

      {mode === "rag" && <RagPanel />}

      <div className="panels" style={{ display: mode === "rag" ? "none" : "flex" }}>
        <div className="panel editor-panel">
          <div className="panel-label">
            <span>{mode === "arch" ? "Description" : "Tables"}</span>
          </div>
          {mode === "arch" ? (
            <textarea
              className="editor"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={archPlaceholder}
              spellCheck={false}
            />
          ) : (
            <SchemaPanel onMermaidChange={(code) => { setMermaidCode(code); setError(""); }} />
          )}
        </div>

        <div className="divider" />

        <div className="panel diagram-panel">
          <div className="panel-label">
            <span>Live Preview</span>
            {mermaidCode && (
              <div className="diagram-panel-actions">
                <div className="zoom-controls">
                  <button onClick={() => changeZoom(-0.1)} title="Zoom out">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
                  </button>
                  <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => changeZoom(0.1)} title="Zoom in">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                  <button className="zoom-reset" onClick={() => setZoom(1)}>Reset</button>
                </div>
                <div className="export-controls">
                  <button className="export-btn" onClick={() => exportDiagram("png")} title="Export as PNG">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    PNG
                  </button>
                  <button className="export-btn" onClick={() => exportDiagram("svg")} title="Export as SVG">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    SVG
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="diagram-area" onWheel={handleWheel}>
            {!mermaidCode && !loading && !error && (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12h8M12 8v8"/>
                  </svg>
                </div>
                <p className="empty-title">
                  {mode === "arch" ? "Start describing your architecture" : "Add tables to visualize your schema"}
                </p>
                <p className="empty-sub">
                  {mode === "arch" ? "Your diagram will appear here in real time" : "Define tables and columns on the left"}
                </p>
              </div>
            )}
            {error && (
              <div className="error-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                {error}
              </div>
            )}
            <div
              ref={diagramRef}
              className="diagram"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
            />
          </div>

          {mermaidCode && (
            <details className="mermaid-source">
              <summary>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
                Mermaid source
              </summary>
              <pre>{mermaidCode}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
