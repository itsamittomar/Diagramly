import { useState, useCallback, useRef, type DragEvent } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  MarkerType,
  type OnConnect,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeMouseHandler,
  ConnectionLineType,
  NodeResizer,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ── Editable label ────────────────────────────────────────────────────

function EditableLabel({ nodeId, label }: { nodeId: string; label: string }) {
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(label);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    updateNodeData(nodeId, { label: draft });
  };

  if (editing) {
    return (
      <input
        className="draw-node-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        autoFocus
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  return <span onDoubleClick={startEdit} style={{ cursor: "text", userSelect: "none" }}>{label || "Double-click"}</span>;
}

// ── All handles ───────────────────────────────────────────────────────

function AllHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </>
  );
}

// ── Flowchart shape nodes ─────────────────────────────────────────────

const RESIZER_COLOR = "#6366f1";

function ProcessNode({ id, data, selected }: NodeProps) {
  return (
    <div className={`draw-node draw-node-process${selected ? " selected" : ""}`} style={{ width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={80} minHeight={36} />
      <AllHandles /><EditableLabel nodeId={id} label={data.label as string} />
    </div>
  );
}

function DecisionNode({ id, data, selected }: NodeProps) {
  const s = selected ? "#8b5cf6" : "#f59e0b";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={80} minHeight={50} />
      <svg width="100%" height="100%" viewBox="0 0 130 75" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <polygon points="65,4 126,37 65,71 4,37" fill="#1a1d2e" stroke={s} strokeWidth="2" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 11, padding: "0 20px", textAlign: "center" }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}

function TerminalNode({ id, data, selected }: NodeProps) {
  return (
    <div className={`draw-node draw-node-terminal${selected ? " selected" : ""}`} style={{ width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={80} minHeight={36} />
      <AllHandles /><EditableLabel nodeId={id} label={data.label as string} />
    </div>
  );
}

function DatabaseNode({ id, data, selected }: NodeProps) {
  const s = selected ? "#8b5cf6" : "#10b981";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={60} minHeight={70} />
      <svg width="100%" height="100%" viewBox="0 0 90 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <rect x="5" y="15" width="80" height="70" fill="#1a1d2e" stroke={s} strokeWidth="2" />
        <ellipse cx="45" cy="15" rx="40" ry="10" fill="#1a1d2e" stroke={s} strokeWidth="2" />
        <ellipse cx="45" cy="85" rx="40" ry="10" fill="#1a1d2e" stroke={s} strokeWidth="2" />
      </svg>
      <div style={{ position: "absolute", inset: "20% 0", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 11, textAlign: "center", padding: "0 8px" }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}

function ActorNode({ id, data, selected }: NodeProps) {
  const s = selected ? "#8b5cf6" : "#e879f9";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={50} minHeight={80} />
      <svg width="100%" height="80%" viewBox="0 0 70 82" preserveAspectRatio="xMidYMid meet" style={{ flex: 1 }}>
        <circle cx="35" cy="18" r="14" fill="#1a1d2e" stroke={s} strokeWidth="2" />
        <line x1="35" y1="32" x2="35" y2="65" stroke={s} strokeWidth="2" />
        <line x1="12" y1="48" x2="58" y2="48" stroke={s} strokeWidth="2" />
        <line x1="35" y1="65" x2="16" y2="82" stroke={s} strokeWidth="2" />
        <line x1="35" y1="65" x2="54" y2="82" stroke={s} strokeWidth="2" />
      </svg>
      <div style={{ fontSize: 11, color: "#e2e8f0", textAlign: "center", width: "100%", padding: "2px 4px" }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} id="l" style={{ top: "40%" }} />
      <Handle type="source" position={Position.Right} id="r" style={{ top: "40%" }} />
    </div>
  );
}

function CloudNode({ id, data, selected }: NodeProps) {
  const s = selected ? "#8b5cf6" : "#38bdf8";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={100} minHeight={60} />
      <svg width="100%" height="100%" viewBox="0 0 130 80" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <path d="M105,62 Q120,62 120,48 Q120,36 108,34 Q108,20 96,16 Q84,10 72,18 Q64,10 52,14 Q38,14 34,26 Q22,26 18,38 Q12,50 22,58 Q26,66 38,64 Z" fill="#1a1d2e" stroke={s} strokeWidth="2" />
      </svg>
      <div style={{ position: "absolute", inset: "12% 8% 8%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 11, textAlign: "center" }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}

function QueueNode({ id, data, selected }: NodeProps) {
  const s = selected ? "#8b5cf6" : "#fb923c";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={90} minHeight={44} />
      <svg width="100%" height="100%" viewBox="0 0 130 60" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <rect x="16" y="8" width="98" height="44" fill="#1a1d2e" stroke={s} strokeWidth="2" />
        <ellipse cx="16" cy="30" rx="12" ry="22" fill="#1a1d2e" stroke={s} strokeWidth="2" />
        <ellipse cx="114" cy="30" rx="12" ry="22" fill="#1a1d2e" stroke={s} strokeWidth="2" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 11, textAlign: "center", padding: "0 18%" }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </div>
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function HexagonNode({ id, data, selected }: NodeProps) {
  const s = selected ? "#8b5cf6" : "#a78bfa";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={70} minHeight={60} />
      <svg width="100%" height="100%" viewBox="0 0 110 95" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <polygon points="55,5 103,28 103,72 55,90 7,72 7,28" fill="#1a1d2e" stroke={s} strokeWidth="2" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 11, textAlign: "center", padding: "0 14%" }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}

function DocumentNode({ id, data, selected }: NodeProps) {
  const s = selected ? "#8b5cf6" : "#94a3b8";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={70} minHeight={60} />
      <svg width="100%" height="100%" viewBox="0 0 100 90" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <polygon points="5,5 75,5 95,25 95,85 5,85" fill="#1a1d2e" stroke={s} strokeWidth="2" />
        <polyline points="75,5 75,25 95,25" fill="none" stroke={s} strokeWidth="2" />
        <line x1="20" y1="42" x2="80" y2="42" stroke={s} strokeWidth="1.5" strokeOpacity="0.5" />
        <line x1="20" y1="54" x2="80" y2="54" stroke={s} strokeWidth="1.5" strokeOpacity="0.5" />
        <line x1="20" y1="66" x2="60" y2="66" stroke={s} strokeWidth="1.5" strokeOpacity="0.5" />
      </svg>
      <div style={{ position: "absolute", inset: "12% 8%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 11, textAlign: "center" }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </div>
      <AllHandles />
    </div>
  );
}

function NoteNode({ id, data, selected }: NodeProps) {
  const s = selected ? "#8b5cf6" : "#fbbf24";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={80} minHeight={60} />
      <svg width="100%" height="100%" viewBox="0 0 120 90" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <polygon points="5,5 100,5 100,70 85,85 5,85" fill="#1e1a0e" stroke={s} strokeWidth="2" />
        <polyline points="85,70 100,70 85,85" fill="#2a2010" stroke={s} strokeWidth="2" />
      </svg>
      <div style={{ position: "absolute", inset: "12% 16% 18% 10%", zIndex: 1, fontSize: 11, color: "#fde68a", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </div>
      <AllHandles />
    </div>
  );
}

function ParallelogramNode({ id, data, selected }: NodeProps) {
  const s = selected ? "#8b5cf6" : "#34d399";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={90} minHeight={40} />
      <svg width="100%" height="100%" viewBox="0 0 130 60" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <polygon points="20,5 125,5 110,55 5,55" fill="#1a1d2e" stroke={s} strokeWidth="2" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 11, textAlign: "center", padding: "0 15%" }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  );
}

function SubprocessNode({ id, data, selected }: NodeProps) {
  const s = selected ? "#8b5cf6" : "#6366f1";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={90} minHeight={40} />
      <svg width="100%" height="100%" viewBox="0 0 130 60" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <rect x="3" y="3" width="124" height="54" rx="4" fill="#1a1d2e" stroke={s} strokeWidth="2" />
        <rect x="10" y="10" width="110" height="40" rx="2" fill="none" stroke={s} strokeWidth="1" strokeOpacity="0.5" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 11, textAlign: "center", padding: "0 12%" }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </div>
      <AllHandles />
    </div>
  );
}

// ── Technology / Service nodes ────────────────────────────────────────

interface ServiceDef {
  color: string;
  bg: string;
  icon: (c: string) => React.ReactNode;
}

const SERVICE_REGISTRY: Record<string, ServiceDef> = {
  kafka: {
    color: "#e87316", bg: "#1a1208",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="7" cy="14" r="4" stroke={c} strokeWidth="2" />
        <circle cx="22" cy="7" r="3" stroke={c} strokeWidth="1.5" />
        <circle cx="22" cy="21" r="3" stroke={c} strokeWidth="1.5" />
        <line x1="11" y1="12" x2="19" y2="9" stroke={c} strokeWidth="1.5" />
        <line x1="11" y1="16" x2="19" y2="19" stroke={c} strokeWidth="1.5" />
      </svg>
    ),
  },
  mongodb: {
    color: "#00ed64", bg: "#071a0e",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14,2 C14,2 20,9 20,16 C20,21 17,24 14,25 C11,24 8,21 8,16 C8,9 14,2 14,2 Z" stroke={c} strokeWidth="2" fill="none" />
        <line x1="14" y1="24" x2="14" y2="28" stroke={c} strokeWidth="2" />
      </svg>
    ),
  },
  redis: {
    color: "#dc382d", bg: "#1a0808",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <polygon points="16,2 8,14 13,14 11,26 19,12 14,12" stroke={c} strokeWidth="1.5" fill={c} fillOpacity="0.2" />
      </svg>
    ),
  },
  postgres: {
    color: "#336791", bg: "#080e1a",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <ellipse cx="14" cy="11" rx="9" ry="9" stroke={c} strokeWidth="2" />
        <path d="M5,14 Q2,20 4,25 Q7,25 8,20" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="11" cy="9" r="1.5" fill={c} />
        <path d="M19,8 Q24,6 23,14 Q19,15 18,11" stroke={c} strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  mysql: {
    color: "#00618a", bg: "#080e14",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14,4 Q20,8 22,14 Q20,20 14,22 Q10,20 8,14" stroke={c} strokeWidth="2" fill="none" />
        <path d="M14,22 Q8,24 6,20 Q4,15 8,14" stroke={c} strokeWidth="2" fill="none" />
        <circle cx="14" cy="12" r="3" stroke={c} strokeWidth="2" />
      </svg>
    ),
  },
  rabbitmq: {
    color: "#ff6600", bg: "#1a0e00",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="6" y="10" width="16" height="14" rx="3" stroke={c} strokeWidth="2" />
        <path d="M10,10 Q10,4 14,4 Q18,4 18,10" stroke={c} strokeWidth="2" fill="none" />
        <circle cx="11" cy="16" r="1.5" fill={c} />
        <circle cx="17" cy="16" r="1.5" fill={c} />
      </svg>
    ),
  },
  elasticsearch: {
    color: "#f7a41d", bg: "#1a1400",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="10" stroke={c} strokeWidth="2" />
        <line x1="6" y1="11" x2="22" y2="11" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="14" x2="22" y2="14" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="17" x2="22" y2="17" stroke={c} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  apigateway: {
    color: "#8b5cf6", bg: "#0e0a1a",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14,2 L26,9 L26,19 L14,26 L2,19 L2,9 Z" stroke={c} strokeWidth="2" fill="none" />
        <line x1="7" y1="12" x2="21" y2="12" stroke={c} strokeWidth="1.5" />
        <line x1="7" y1="16" x2="21" y2="16" stroke={c} strokeWidth="1.5" />
        <polyline points="17,9 21,12 17,15" stroke={c} strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  loadbalancer: {
    color: "#6366f1", bg: "#0a0a1a",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="6" r="3" stroke={c} strokeWidth="2" />
        <circle cx="6" cy="22" r="3" stroke={c} strokeWidth="2" />
        <circle cx="22" cy="22" r="3" stroke={c} strokeWidth="2" />
        <line x1="14" y1="9" x2="7" y2="19" stroke={c} strokeWidth="1.5" />
        <line x1="14" y1="9" x2="21" y2="19" stroke={c} strokeWidth="1.5" />
        <line x1="14" y1="9" x2="14" y2="19" stroke={c} strokeWidth="1.5" strokeDasharray="2 2" />
      </svg>
    ),
  },
  docker: {
    color: "#2496ed", bg: "#050e1a",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="3" y="12" width="22" height="10" rx="2" stroke={c} strokeWidth="2" />
        <rect x="6" y="8" width="5" height="4" stroke={c} strokeWidth="1.5" />
        <rect x="12" y="8" width="5" height="4" stroke={c} strokeWidth="1.5" />
        <rect x="12" y="3" width="5" height="4" stroke={c} strokeWidth="1.5" />
        <path d="M25,16 Q28,12 24,10" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  kubernetes: {
    color: "#326ce5", bg: "#050a1a",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="10" stroke={c} strokeWidth="2" />
        <circle cx="14" cy="14" r="3" stroke={c} strokeWidth="1.5" />
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const r1 = 5, r2 = 9;
          const rad = (deg * Math.PI) / 180;
          return (
            <line key={i}
              x1={14 + r1 * Math.cos(rad)} y1={14 + r1 * Math.sin(rad)}
              x2={14 + r2 * Math.cos(rad)} y2={14 + r2 * Math.sin(rad)}
              stroke={c} strokeWidth="1.5" strokeLinecap="round"
            />
          );
        })}
      </svg>
    ),
  },
  lambda: {
    color: "#ff9900", bg: "#1a1000",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M6,24 L10,14 L14,18 L20,6" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14,24 L20,6" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeOpacity="0.4" />
      </svg>
    ),
  },
  s3: {
    color: "#569a31", bg: "#091408",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14,4 L24,9 L24,19 L14,24 L4,19 L4,9 Z" stroke={c} strokeWidth="2" fill="none" />
        <ellipse cx="14" cy="9" rx="10" ry="4" stroke={c} strokeWidth="1.5" fill="none" />
        <line x1="14" y1="13" x2="14" y2="24" stroke={c} strokeWidth="1.5" strokeDasharray="2 2" />
      </svg>
    ),
  },
  nginx: {
    color: "#009639", bg: "#07130a",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14,2 L26,9 L26,19 L14,26 L2,19 L2,9 Z" stroke={c} strokeWidth="2" fill="none" />
        <text x="14" y="19" textAnchor="middle" fill={c} fontSize="13" fontWeight="bold" fontFamily="monospace">N</text>
      </svg>
    ),
  },
  grpc: {
    color: "#5aa9e6", bg: "#070e14",
    icon: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="7" cy="10" r="3" stroke={c} strokeWidth="1.5" />
        <circle cx="7" cy="20" r="3" stroke={c} strokeWidth="1.5" />
        <circle cx="21" cy="14" r="3" stroke={c} strokeWidth="1.5" />
        <line x1="10" y1="11" x2="18" y2="13" stroke={c} strokeWidth="1.5" />
        <line x1="10" y1="19" x2="18" y2="15" stroke={c} strokeWidth="1.5" />
        <polyline points="15,11 18,13 15,15" stroke={c} strokeWidth="1.5" fill="none" />
        <polyline points="15,17 18,15 15,13" stroke={c} strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
};

function ServiceNode({ id, data, selected }: NodeProps) {
  const serviceType = (data.service as string) ?? "apigateway";
  const def = SERVICE_REGISTRY[serviceType] ?? SERVICE_REGISTRY.apigateway;
  const borderColor = selected ? "#8b5cf6" : def.color;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: def.bg,
        border: `2px solid ${borderColor}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 6px",
        boxShadow: selected ? `0 0 0 2px rgba(139,92,246,0.3)` : `0 0 12px ${def.color}22`,
      }}
    >
      <NodeResizer color={RESIZER_COLOR} isVisible={!!selected} minWidth={70} minHeight={70} />
      <AllHandles />
      {def.icon(def.color)}
      <span style={{ fontSize: 11, color: "#e2e8f0", textAlign: "center", lineHeight: 1.3 }}>
        <EditableLabel nodeId={id} label={data.label as string} />
      </span>
    </div>
  );
}

// ── Node type registry ────────────────────────────────────────────────

const nodeTypes = {
  process: ProcessNode,
  decision: DecisionNode,
  terminal: TerminalNode,
  database: DatabaseNode,
  actor: ActorNode,
  cloud: CloudNode,
  queue: QueueNode,
  hexagon: HexagonNode,
  document: DocumentNode,
  note: NoteNode,
  parallelogram: ParallelogramNode,
  subprocess: SubprocessNode,
  service: ServiceNode,
};

// ── Sidebar items ─────────────────────────────────────────────────────

const SHAPE_ITEMS = [
  { type: "process", label: "Process", icon: <svg width="42" height="26"><rect x="2" y="2" width="38" height="22" rx="3" fill="#1a1d2e" stroke="#6366f1" strokeWidth="2" /></svg> },
  { type: "decision", label: "Decision", icon: <svg width="42" height="28"><polygon points="21,2 40,14 21,26 2,14" fill="#1a1d2e" stroke="#f59e0b" strokeWidth="2" /></svg> },
  { type: "terminal", label: "Terminal", icon: <svg width="42" height="24"><rect x="2" y="2" width="38" height="20" rx="10" fill="#1a1d2e" stroke="#10b981" strokeWidth="2" /></svg> },
  { type: "database", label: "Database", icon: <svg width="34" height="36"><rect x="2" y="9" width="30" height="22" fill="#1a1d2e" stroke="#10b981" strokeWidth="2" /><ellipse cx="17" cy="9" rx="15" ry="5" fill="#1a1d2e" stroke="#10b981" strokeWidth="2" /><ellipse cx="17" cy="31" rx="15" ry="5" fill="#1a1d2e" stroke="#10b981" strokeWidth="2" /></svg> },
  { type: "actor", label: "Actor", icon: <svg width="28" height="42"><circle cx="14" cy="8" r="7" fill="#1a1d2e" stroke="#e879f9" strokeWidth="2" /><line x1="14" y1="15" x2="14" y2="30" stroke="#e879f9" strokeWidth="2" /><line x1="4" y1="22" x2="24" y2="22" stroke="#e879f9" strokeWidth="2" /><line x1="14" y1="30" x2="6" y2="40" stroke="#e879f9" strokeWidth="2" /><line x1="14" y1="30" x2="22" y2="40" stroke="#e879f9" strokeWidth="2" /></svg> },
  { type: "cloud", label: "Cloud", icon: <svg width="44" height="30"><path d="M36,24 Q44,24 44,17 Q44,11 37,10 Q37,4 30,2 Q23,0 18,5 Q13,1 7,4 Q2,6 2,12 Q-2,16 2,21 Q4,26 11,24 Z" fill="#1a1d2e" stroke="#38bdf8" strokeWidth="2" /></svg> },
  { type: "queue", label: "Queue", icon: <svg width="44" height="28"><rect x="8" y="4" width="28" height="20" fill="#1a1d2e" stroke="#fb923c" strokeWidth="2" /><ellipse cx="8" cy="14" rx="6" ry="10" fill="#1a1d2e" stroke="#fb923c" strokeWidth="2" /><ellipse cx="36" cy="14" rx="6" ry="10" fill="#1a1d2e" stroke="#fb923c" strokeWidth="2" /></svg> },
  { type: "hexagon", label: "Hexagon", icon: <svg width="38" height="34"><polygon points="19,2 34,10 34,26 19,34 4,26 4,10" fill="#1a1d2e" stroke="#a78bfa" strokeWidth="2" /></svg> },
  { type: "document", label: "Document", icon: <svg width="30" height="36"><polygon points="2,2 20,2 28,10 28,34 2,34" fill="#1a1d2e" stroke="#94a3b8" strokeWidth="2" /><polyline points="20,2 20,10 28,10" fill="none" stroke="#94a3b8" strokeWidth="2" /></svg> },
  { type: "note", label: "Note", icon: <svg width="36" height="30"><polygon points="2,2 28,2 28,22 20,30 2,30" fill="#1e1a0e" stroke="#fbbf24" strokeWidth="2" /><polyline points="20,22 28,22 20,30" fill="none" stroke="#fbbf24" strokeWidth="2" /></svg> },
  { type: "parallelogram", label: "I / O", icon: <svg width="44" height="26"><polygon points="10,2 42,2 34,24 2,24" fill="#1a1d2e" stroke="#34d399" strokeWidth="2" /></svg> },
  { type: "subprocess", label: "Subprocess", icon: <svg width="42" height="26"><rect x="2" y="2" width="38" height="22" rx="3" fill="#1a1d2e" stroke="#6366f1" strokeWidth="2" /><rect x="6" y="6" width="30" height="14" rx="1" fill="none" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.6" /></svg> },
];

const SERVICE_ITEMS: { serviceType: string; label: string }[] = [
  { serviceType: "kafka", label: "Kafka" },
  { serviceType: "rabbitmq", label: "RabbitMQ" },
  { serviceType: "mongodb", label: "MongoDB" },
  { serviceType: "redis", label: "Redis" },
  { serviceType: "postgres", label: "PostgreSQL" },
  { serviceType: "mysql", label: "MySQL" },
  { serviceType: "elasticsearch", label: "Elastic" },
  { serviceType: "apigateway", label: "API GW" },
  { serviceType: "loadbalancer", label: "Load Balancer" },
  { serviceType: "docker", label: "Docker" },
  { serviceType: "kubernetes", label: "Kubernetes" },
  { serviceType: "lambda", label: "Lambda" },
  { serviceType: "s3", label: "S3 / Storage" },
  { serviceType: "nginx", label: "Nginx" },
  { serviceType: "grpc", label: "gRPC / REST" },
];

function ShapeItem({ type, label, icon }: { type: string; label: string; icon: React.ReactNode }) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData("application/reactflow/type", type);
    e.dataTransfer.setData("application/reactflow/service", "");
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div className="draw-shape-item" draggable onDragStart={onDragStart} title={label}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function ServiceItem({ serviceType, label }: { serviceType: string; label: string }) {
  const def = SERVICE_REGISTRY[serviceType];
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData("application/reactflow/type", "service");
    e.dataTransfer.setData("application/reactflow/service", serviceType);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div className="draw-shape-item draw-service-item" draggable onDragStart={onDragStart} title={label}
      style={{ borderColor: `${def?.color}44` }}>
      {def?.icon(def.color)}
      <span style={{ color: def?.color }}>{label}</span>
    </div>
  );
}

// ── Edge helpers ──────────────────────────────────────────────────────

type EdgeStyle = "solid" | "dashed" | "dotted";

function edgeDash(s: EdgeStyle) {
  if (s === "dashed") return { strokeDasharray: "6 3" };
  if (s === "dotted") return { strokeDasharray: "2 3" };
  return {};
}

function makeEdgeOptions(edgeStyle: EdgeStyle) {
  return {
    markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
    style: { stroke: "#6366f1", strokeWidth: 2, ...edgeDash(edgeStyle) },
  };
}

// ── Default labels ────────────────────────────────────────────────────

function defaultLabel(type: string, service?: string): string {
  if (type === "service" && service) {
    return SERVICE_ITEMS.find((s) => s.serviceType === service)?.label ?? service;
  }
  const m: Record<string, string> = {
    process: "Process", decision: "Decision?", terminal: "Start / End",
    database: "Database", actor: "User", cloud: "Cloud Service",
    queue: "Message Queue", hexagon: "API Gateway", document: "Document",
    note: "Note...", parallelogram: "Input / Output", subprocess: "Subprocess",
  };
  return m[type] ?? "Node";
}

let nodeIdCounter = 1;

const DEFAULT_NODE_SIZES: Record<string, { width: number; height: number }> = {
  process:       { width: 130, height: 50  },
  decision:      { width: 130, height: 75  },
  terminal:      { width: 130, height: 50  },
  database:      { width: 90,  height: 100 },
  actor:         { width: 70,  height: 110 },
  cloud:         { width: 130, height: 80  },
  queue:         { width: 130, height: 60  },
  hexagon:       { width: 110, height: 95  },
  document:      { width: 100, height: 90  },
  note:          { width: 120, height: 90  },
  parallelogram: { width: 130, height: 60  },
  subprocess:    { width: 130, height: 60  },
  service:       { width: 100, height: 95  },
};

// ── Canvas ────────────────────────────────────────────────────────────

function DrawCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>("solid");
  const [connType, setConnType] = useState<ConnectionLineType>(ConnectionLineType.SmoothStep);
  const { screenToFlowPosition } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  const onConnect: OnConnect = useCallback(
    (params) =>
      setEdges((es) =>
        addEdge({
          ...params,
          ...makeEdgeOptions(edgeStyle),
          type: connType === ConnectionLineType.Straight ? "straight"
            : connType === ConnectionLineType.Step ? "step" : "smoothstep",
        }, es)
      ),
    [setEdges, edgeStyle, connType]
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow/type");
      const service = e.dataTransfer.getData("application/reactflow/service");
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const size = DEFAULT_NODE_SIZES[type] ?? { width: 130, height: 60 };
      setNodes((ns) => [
        ...ns,
        {
          id: `node-${nodeIdCounter++}`,
          type,
          position,
          style: size,
          data: { label: defaultLabel(type, service), ...(service ? { service } : {}) },
        },
      ]);
    },
    [screenToFlowPosition, setNodes]
  );

  const onEdgeDoubleClick: EdgeMouseHandler = useCallback(
    (_e, edge) => {
      const current = typeof edge.label === "string" ? edge.label : "";
      const label = window.prompt("Edge label:", current);
      if (label !== null) setEdges((es) => es.map((e) => (e.id === edge.id ? { ...e, label } : e)));
    },
    [setEdges]
  );

  const clearAll = () => { setNodes([]); setEdges([]); };

  const exportAs = (format: "png" | "svg") => {
    const container = containerRef.current;
    if (!container) return;
    const svgEl = container.querySelector<SVGSVGElement>(".react-flow__renderer svg");
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (format === "svg") {
      const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.download = "diagram.svg"; a.href = url; a.click();
      URL.revokeObjectURL(url); return;
    }
    const w = svgEl.clientWidth || 800, h = svgEl.clientHeight || 600, scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale); ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, w, h);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      const a = document.createElement("a"); a.download = "diagram.png"; a.href = canvas.toDataURL("image/png"); a.click();
    };
    img.src = url;
  };

  return (
    <div className="draw-panel">
      {/* Sidebar */}
      <div className="draw-sidebar">
        <div className="draw-sidebar-section">
          <div className="draw-sidebar-title">Shapes</div>
          <div className="draw-sidebar-grid">
            {SHAPE_ITEMS.map((s) => <ShapeItem key={s.type} {...s} />)}
          </div>
        </div>
        <div className="draw-sidebar-section">
          <div className="draw-sidebar-title">Services</div>
          <div className="draw-sidebar-grid">
            {SERVICE_ITEMS.map((s) => <ServiceItem key={s.serviceType} {...s} />)}
          </div>
        </div>
        <div className="draw-sidebar-hint">Drag onto canvas</div>
      </div>

      {/* Canvas */}
      <div className="draw-canvas-wrapper" ref={containerRef}>
        <div className="draw-toolbar">
          <div className="draw-toolbar-group">
            <span className="draw-toolbar-label">Edge</span>
            {(["solid", "dashed", "dotted"] as EdgeStyle[]).map((s) => (
              <button key={s} className={`draw-toolbar-btn${edgeStyle === s ? " active" : ""}`} onClick={() => setEdgeStyle(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="draw-toolbar-group">
            <span className="draw-toolbar-label">Route</span>
            {([
              { t: ConnectionLineType.SmoothStep, l: "Smooth" },
              { t: ConnectionLineType.Step, l: "Step" },
              { t: ConnectionLineType.Straight, l: "Straight" },
            ] as const).map(({ t, l }) => (
              <button key={t} className={`draw-toolbar-btn${connType === t ? " active" : ""}`} onClick={() => setConnType(t)}>{l}</button>
            ))}
          </div>
          <div className="draw-toolbar-divider" />
          <button className="draw-toolbar-btn" onClick={clearAll}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
            Clear
          </button>
          <button className="draw-toolbar-btn" onClick={() => exportAs("png")}>PNG</button>
          <button className="draw-toolbar-btn" onClick={() => exportAs("svg")}>SVG</button>
          <span className="draw-toolbar-hint">Double-click node/edge to rename · Del to remove</span>
        </div>

        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
          onEdgeDoubleClick={onEdgeDoubleClick}
          nodeTypes={nodeTypes}
          connectionLineType={connType}
          deleteKeyCode="Delete"
          fitView
          style={{ background: "#0f1117" }}
        >
          <Background variant={BackgroundVariant.Dots} color="#1e2130" gap={20} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function DrawPanel() {
  return <ReactFlowProvider><DrawCanvas /></ReactFlowProvider>;
}
