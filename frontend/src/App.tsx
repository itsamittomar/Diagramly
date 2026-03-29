import { useState, useEffect, useRef, useCallback } from "react";
import mermaid from "mermaid";
import SchemaPanel from "./SchemaPanel";
import RagPanel from "./RagPanel";
import DrawPanel from "./DrawPanel";
import Login from "./Login";
import "./App.css";

mermaid.initialize({ startOnLoad: false, theme: "neutral" });

function styleAndAnimateDiagram(container: HTMLDivElement) {
  const svg = container.querySelector("svg");
  if (!svg) return;

  // Ensure <defs> exists
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  // Gradients per node type + drop-shadow filter
  defs.insertAdjacentHTML("beforeend", `
    <linearGradient id="ng-user" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
    <linearGradient id="ng-service" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="ng-db" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="100%" stop-color="#065f46"/>
    </linearGradient>
    <filter id="nf-shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  `);

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    /* ── Node shapes ── */
    .node ellipse, .node circle {
      fill: url(#ng-user) !important;
      stroke: #a5b4fc !important;
      stroke-width: 2px !important;
      filter: url(#nf-shadow) !important;
    }
    .node rect {
      fill: url(#ng-service) !important;
      stroke: #6366f1 !important;
      stroke-width: 1.5px !important;
      rx: 14px; ry: 14px;
      filter: url(#nf-shadow) !important;
    }
    .node path {
      fill: url(#ng-db) !important;
      stroke: #34d399 !important;
      stroke-width: 1.5px !important;
      filter: url(#nf-shadow) !important;
    }
    /* ── Node labels ── */
    .nodeLabel, .nodeLabel p,
    .label,     .label p {
      color: #f1f5f9 !important;
      font-weight: 600 !important;
      font-family: 'Inter', system-ui, sans-serif !important;
      font-size: 13px !important;
    }
    /* ── Edge label background rects (SVG elements only) ── */
    .edgeLabel rect, .labelBkg, .edgeLabelBackground {
      fill: #4f46e5 !important;
      stroke: #818cf8 !important;
      stroke-width: 1px !important;
      rx: 6px !important;
      filter: none !important;
    }
    /* SVG text-based edge labels */
    .edgeLabel text, .edgeLabel tspan {
      fill: #ffffff !important;
      font-weight: 600 !important;
    }
    /* ── Animated edges ── */
    @keyframes edgeFlow {
      from { stroke-dashoffset: 24; }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes edgeGlow {
      0%, 100% { filter: drop-shadow(0 0 3px #6366f1) drop-shadow(0 0 8px #4f46e5); }
      50%       { filter: drop-shadow(0 0 6px #a5b4fc) drop-shadow(0 0 18px #6366f1); }
    }
    .edge-flow {
      stroke: #6366f1 !important;
      stroke-width: 2px !important;
      stroke-dasharray: 8 4 !important;
      animation: edgeFlow 0.8s linear infinite, edgeGlow 2s ease-in-out infinite !important;
    }
  `;
  svg.prepend(style);

  // Apply rounded corners to service rects directly (CSS rx doesn't work in all browsers)
  svg.querySelectorAll<SVGRectElement>(".node rect").forEach((rect) => {
    rect.setAttribute("rx", "14");
    rect.setAttribute("ry", "14");
  });

  // Style edge label background rects (SVG elements — work fine with setAttribute)
  svg.querySelectorAll<SVGRectElement>(
    ".edgeLabel rect, .labelBkg, .edgeLabelBackground"
  ).forEach((rect) => {
    rect.setAttribute("fill", "#4f46e5");
    rect.setAttribute("stroke", "#818cf8");
    rect.setAttribute("rx", "6");
    rect.setAttribute("ry", "6");
  });

  // Force white text in SVG text nodes
  svg.querySelectorAll<SVGTextElement>(".edgeLabel text, .edgeLabel tspan").forEach((t) => {
    t.style.fill = "#ffffff";
    t.style.fontWeight = "600";
  });

  // foreignObject content inherits from the DOCUMENT stylesheet (not SVG styles),
  // so inject a document-level <style> tag once to reach the HTML inside foreignObject.
  if (!document.getElementById("mermaid-edgelabel-fix")) {
    const docStyle = document.createElement("style");
    docStyle.id = "mermaid-edgelabel-fix";
    docStyle.textContent = `
      .edgeLabel foreignObject div,
      .edgeLabel foreignObject span,
      .edgeLabel foreignObject p {
        color: #ffffff !important;
        background-color: transparent !important;
        font-weight: 600 !important;
        font-size: 12px !important;
        font-family: 'Inter', system-ui, sans-serif !important;
      }
    `;
    document.head.appendChild(docStyle);
  }

  // Animate edge paths
  svg.querySelectorAll<SVGPathElement>(
    ".edgePath path.path, .edgePath path, .flowchart-link, .edge-pattern"
  ).forEach((p) => p.classList.add("edge-flow"));

  // Recolor arrowheads
  svg.querySelectorAll<SVGElement>(".marker path, .arrowheadPath").forEach((m) => {
    m.style.fill = "#6366f1";
    m.style.stroke = "#6366f1";
  });
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type Mode = "arch" | "schema" | "draw" | "rag";

interface User {
  email: string;
  name: string;
  picture: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("arch");
  const [lockedToast, setLockedToast] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"editor" | "preview">("editor");
  const [text, setText] = useState("");
  const [mermaidCode, setMermaidCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const diagramRef = useRef<HTMLDivElement>(null);
  const debouncedText = useDebounce(text, 800);

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null));
  }, []);

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

  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const addSvgWatermark = (svg: SVGElement, w: number, h: number) => {
    const boxW = 118, boxH = 30;
    const bx = (w - boxW) / 2;   // horizontally centered
    const by = h - boxH - 12;

    const ns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(ns, "g");

    // Pill background
    const pill = document.createElementNS(ns, "rect");
    pill.setAttribute("x", String(bx));
    pill.setAttribute("y", String(by));
    pill.setAttribute("width", String(boxW));
    pill.setAttribute("height", String(boxH));
    pill.setAttribute("rx", "15");
    pill.setAttribute("fill", "rgba(15,23,42,0.82)");
    pill.setAttribute("stroke", "rgba(255,255,255,0.1)");
    pill.setAttribute("stroke-width", "1");
    g.appendChild(pill);

    // Brand icon — 4 squares (scaled from 24×24 viewbox to ~14×14)
    const ix = bx + 10, iy = by + 8, s = 5, gap = 3;
    [
      [ix,       iy      ],
      [ix+s+gap, iy      ],
      [ix,       iy+s+gap],
      [ix+s+gap, iy+s+gap],
    ].forEach(([x, y]) => {
      const sq = document.createElementNS(ns, "rect");
      sq.setAttribute("x", String(x));
      sq.setAttribute("y", String(y));
      sq.setAttribute("width", String(s));
      sq.setAttribute("height", String(s));
      sq.setAttribute("rx", "1.2");
      sq.setAttribute("fill", "#6366f1");
      g.appendChild(sq);
    });

    // "Diagramly" text
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", String(bx + 34));
    text.setAttribute("y", String(by + 19));
    text.setAttribute("font-family", "Inter, system-ui, sans-serif");
    text.setAttribute("font-size", "12");
    text.setAttribute("font-weight", "600");
    text.setAttribute("letter-spacing", "0.4");
    text.setAttribute("fill", "#f8fafc");
    text.textContent = "Diagramly";
    g.appendChild(text);

    svg.appendChild(g);
  };

  const exportDiagram = (format: "png" | "svg") => {
    setShowDownloadMenu(false);
    if (!diagramRef.current) return;
    const svgEl = diagramRef.current.querySelector("svg");
    if (!svgEl) return;

    const w = svgEl.viewBox.baseVal.width || svgEl.clientWidth || 800;
    const h = svgEl.viewBox.baseVal.height || svgEl.clientHeight || 600;

    if (format === "svg") {
      const clone = svgEl.cloneNode(true) as SVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      addSvgWatermark(clone, w, h);
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
    const padding = 40;
    const canvas = document.createElement("canvas");
    canvas.width = (w + padding * 2) * scale;
    canvas.height = (h + padding * 2) * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w + padding * 2, h + padding * 2);

    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));

    // Canvas is tainted by <foreignObject> HTML — replace each with an SVG <text> node
    clone.querySelectorAll("foreignObject").forEach((fo) => {
      const content = fo.querySelector("p, span, div")?.textContent?.trim() ?? "";
      const fx = parseFloat(fo.getAttribute("x") ?? "0");
      const fy = parseFloat(fo.getAttribute("y") ?? "0");
      const fw = parseFloat(fo.getAttribute("width") ?? "80");
      const fh = parseFloat(fo.getAttribute("height") ?? "20");
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(fx + fw / 2));
      t.setAttribute("y", String(fy + fh / 2 + 4));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-family", "Inter, system-ui, sans-serif");
      t.setAttribute("font-size", "12");
      t.setAttribute("font-weight", "600");
      t.setAttribute("fill", "#ffffff");
      t.textContent = content;
      fo.parentNode?.replaceChild(t, fo);
    });

    // Use data URI (not blob URL) — blob URLs taint the canvas in some browsers
    const svgString = new XMLSerializer().serializeToString(clone);
    const dataURI = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

    const img = new Image();
    img.onerror = () => console.error("SVG failed to load for PNG export");
    img.onload = () => {
      ctx.drawImage(img, padding, padding);

      // Watermark — centered at the bottom
      const totalW = w + padding * 2;
      const totalH = h + padding * 2;
      const bw = 118, bh = 30;
      const bx = (totalW - bw) / 2;
      const by = totalH - bh - 12;

      // Pill background
      ctx.fillStyle = "rgba(15,23,42,0.82)";
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bx, by, bw, bh, 15);
      } else {
        ctx.arc(bx + 15, by + 15, 15, Math.PI / 2, (3 * Math.PI) / 2);
        ctx.lineTo(bx + bw - 15, by);
        ctx.arc(bx + bw - 15, by + 15, 15, (3 * Math.PI) / 2, Math.PI / 2);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();

      // Brand icon — 4 squares
      const ix = bx + 10, iy = by + 8, sq = 5, gap = 3;
      ctx.fillStyle = "#6366f1";
      [[ix, iy], [ix + sq + gap, iy], [ix, iy + sq + gap], [ix + sq + gap, iy + sq + gap]]
        .forEach(([x, y]) => {
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(x, y, sq, sq, 1.2) : ctx.rect(x, y, sq, sq);
          ctx.fill();
        });

      // "Diagramly" text
      ctx.font = "600 12px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.letterSpacing = "0.4px";
      ctx.fillText("Diagramly", bx + 34, by + 19);

      const a = document.createElement("a");
      a.download = "diagram.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = dataURI;
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
        credentials: "include",
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
        if (!diagramRef.current) return;
        diagramRef.current.innerHTML = svg;
        styleAndAnimateDiagram(diagramRef.current);
      })
      .catch((e) => {
        console.error("Mermaid render error:", e);
        console.error("Failed mermaid code:\n", mermaidCode);
        setError("Mermaid render failed. Check console for raw syntax.");
      });
  }, [mermaidCode]);

  if (user === undefined) {
    return (
      <div className="app" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="generating-pill">
          <span className="pulse-dot" />
          Loading…
        </div>
      </div>
    );
  }

  if (user === null) {
    return <Login />;
  }

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
            <span className="mode-btn-label">Architecture</span>
          </button>
          <button
            className={`mode-btn ${mode === "schema" ? "active" : ""}`}
            onClick={() => switchMode("schema")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
            <span className="mode-btn-label">Schema</span>
          </button>
          <button
            className={`mode-btn ${mode === "draw" ? "active" : ""}`}
            onClick={() => switchMode("draw")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><line x1="17.5" y1="14" x2="17.5" y2="21"/><line x1="14" y1="17.5" x2="21" y2="17.5"/>
            </svg>
            <span className="mode-btn-label">Draw</span>
          </button>
          <button
            className="mode-btn mode-btn-locked"
            onClick={() => setLockedToast(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span className="mode-btn-label">Docs</span>
            <span className="coming-soon-badge">Soon</span>
          </button>
        </div>

        <div className="header-right">
          {loading && (
            <div className="generating-pill">
              <span className="pulse-dot" />
              Generating…
            </div>
          )}
          <div className="user-menu">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="user-avatar" referrerPolicy="no-referrer" />
            ) : (
              <div className="user-avatar user-avatar-fallback">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="user-name">{user.name}</span>
            <a href={`${API_BASE}/auth/logout`} className="logout-btn">Sign out</a>
          </div>
        </div>
      </header>

      {lockedToast && (
        <div className="modal-overlay" onClick={() => setLockedToast(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <h2 className="modal-title">Documents — Coming Soon</h2>
            <p className="modal-body">
              We're building a powerful document Q&amp;A experience with RAG.<br/>
              Upload PDFs, Markdown, and CSVs and ask questions across your files.
            </p>
            <button className="modal-close-btn" onClick={() => setLockedToast(false)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {mode === "rag" && <RagPanel />}
      {mode === "draw" && <DrawPanel />}

      {mode !== "rag" && mode !== "draw" && (
        <div className="mobile-panel-tabs">
          <button
            className={`mobile-tab ${mobilePanel === "editor" ? "active" : ""}`}
            onClick={() => setMobilePanel("editor")}
          >
            {mode === "arch" ? "Description" : "Tables"}
          </button>
          <button
            className={`mobile-tab ${mobilePanel === "preview" ? "active" : ""}`}
            onClick={() => setMobilePanel("preview")}
          >
            Preview
          </button>
        </div>
      )}

      <div className="panels" style={{ display: mode === "rag" || mode === "draw" ? "none" : "flex" }}>
        <div className={`panel editor-panel${mobilePanel === "preview" ? " mobile-hidden" : ""}`}>
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

        <div className={`panel diagram-panel${mobilePanel === "editor" ? " mobile-hidden" : ""}`}>
          <div className="panel-label">
            <span>Live Preview</span>
            {mermaidCode && (
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

            {mermaidCode && (
              <div className="download-corner">
                <button
                  className="download-btn"
                  onClick={() => setShowDownloadMenu((v) => !v)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {showDownloadMenu && (
                  <>
                    <div className="download-backdrop" onClick={() => setShowDownloadMenu(false)} />
                    <div className="download-menu download-menu-up">
                      <button onClick={() => exportDiagram("png")}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                        </svg>
                        PNG Image
                        <span className="download-menu-badge">Recommended</span>
                      </button>
                      <button onClick={() => exportDiagram("svg")}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="14 2 14 8 20 8"/><path d="M20 8L14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        </svg>
                        SVG Vector
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
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
