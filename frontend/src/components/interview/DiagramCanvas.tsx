"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// --- Types ---
interface DiagramNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
}

interface Connection {
  id: string;
  from: string;
  to: string;
}

type NodeType = "client" | "server" | "database" | "cache" | "load_balancer" | "queue" | "cdn" | "api_gateway";

// --- Constants ---
const NODE_W = 140;
const NODE_H = 56;
const PORT_R = 6;

const NODE_TYPES: { type: NodeType; label: string; color: string }[] = [
  { type: "client", label: "Client", color: "#3b82f6" },
  { type: "server", label: "Server", color: "#22c55e" },
  { type: "database", label: "Database", color: "#a855f7" },
  { type: "cache", label: "Cache", color: "#f97316" },
  { type: "load_balancer", label: "Load Balancer", color: "#06b6d4" },
  { type: "queue", label: "Queue", color: "#eab308" },
  { type: "cdn", label: "CDN", color: "#ec4899" },
  { type: "api_gateway", label: "API Gateway", color: "#14b8a6" },
];

const colorMap: Record<NodeType, string> = Object.fromEntries(
  NODE_TYPES.map((n) => [n.type, n.color])
) as Record<NodeType, string>;

const iconMap: Record<NodeType, string> = {
  client: "M4 6h16M4 12h16M4 18h16",
  server: "M2 4h20v16H2zM6 20v2M18 20v2",
  database: "M12 2C6.48 2 2 4 2 6v12c0 2 4.48 4 10 4s10-2 10-4V6c0-2-4.48-4-10-4z",
  cache: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  load_balancer: "M12 2v20M2 12h20M7 7l10 10M17 7L7 17",
  queue: "M3 12h4l3-9 4 18 3-9h4",
  cdn: "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10A15 15 0 0112 2z",
  api_gateway: "M4 4h16v16H4zM9 4v16M15 4v16M4 9h16M4 15h16",
};

let idCounter = 0;
const uid = () => `n${++idCounter}`;

// --- Component ---
export default function DiagramCanvas() {
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [dragging, setDragging] = useState<{ id: string; offX: number; offY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ fromId: string; mx: number; my: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);

  // --- Helpers ---
  const svgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  }, []);

  const getCenter = (n: DiagramNode) => ({ x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 });

  // --- Add node ---
  const addNode = (type: NodeType) => {
    const label = NODE_TYPES.find((n) => n.type === type)!.label;
    const x = 80 + Math.random() * 300;
    const y = 80 + Math.random() * 200;
    setNodes((prev) => [...prev, { id: uid(), type, label, x, y }]);
  };

  // --- Drag node ---
  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const node = nodes.find((n) => n.id === id)!;
    const p = svgPoint(e.clientX, e.clientY);
    setDragging({ id, offX: p.x - node.x, offY: p.y - node.y });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const p = svgPoint(e.clientX, e.clientY);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragging.id ? { ...n, x: p.x - dragging.offX, y: p.y - dragging.offY } : n
        )
      );
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, svgPoint]);

  // --- Connection mode ---
  const onPortClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (connecting) {
      // Finish connection
      if (connecting.fromId !== nodeId) {
        const exists = connections.some(
          (c) => c.from === connecting.fromId && c.to === nodeId
        );
        if (!exists) {
          setConnections((prev) => [
            ...prev,
            { id: uid(), from: connecting.fromId, to: nodeId },
          ]);
        }
      }
      setConnecting(null);
    } else {
      // Start connection
      const node = nodes.find((n) => n.id === nodeId)!;
      setConnecting({ fromId: nodeId, mx: node.x + NODE_W, my: node.y + NODE_H / 2 });
    }
  };

  // Track mouse for ghost line while connecting
  useEffect(() => {
    if (!connecting) return;
    const onMove = (e: MouseEvent) => {
      const p = svgPoint(e.clientX, e.clientY);
      setConnecting((prev) => (prev ? { ...prev, mx: p.x, my: p.y } : null));
    };
    const onCancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConnecting(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onCancel);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onCancel);
    };
  }, [connecting, svgPoint]);

  // Cancel connecting on svg click (not on a port)
  const onSvgClick = () => {
    if (connecting) setConnecting(null);
  };

  // --- Delete ---
  const deleteNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter((c) => c.from !== id && c.to !== id));
  };

  const deleteConnection = (id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
  };

  // --- Inline edit ---
  const startEdit = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setEditingId(id);
    setEditLabel(node.label);
  };

  const commitEdit = () => {
    if (editingId && editLabel.trim()) {
      setNodes((prev) =>
        prev.map((n) => (n.id === editingId ? { ...n, label: editLabel.trim() } : n))
      );
    }
    setEditingId(null);
  };

  // --- Arrow path ---
  const arrowPath = (from: DiagramNode, to: DiagramNode) => {
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    const midX = (x1 + x2) / 2;
    return `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
  };

  // --- Render ---
  return (
    <div className="flex flex-col h-full">
      {/* Palette toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-800 flex-wrap">
        {NODE_TYPES.map((nt) => (
          <button
            key={nt.type}
            onClick={() => addNode(nt.type)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-gray-800 hover:bg-gray-700 transition-colors"
            style={{ color: nt.color }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={iconMap[nt.type]} />
            </svg>
            {nt.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-gray-500 mr-2">
          {nodes.length} component{nodes.length !== 1 ? "s" : ""}, {connections.length} connection{connections.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => { setNodes([]); setConnections([]); }}
          className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors font-medium"
        >
          Clear All
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-gray-900">
        <svg
          ref={svgRef}
          className={`w-full h-full ${connecting ? "cursor-crosshair" : ""}`}
          onClick={onSvgClick}
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="0.5" fill="rgba(255,255,255,0.06)" />
            </pattern>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Connections */}
          {connections.map((conn) => {
            const from = nodes.find((n) => n.id === conn.from);
            const to = nodes.find((n) => n.id === conn.to);
            if (!from || !to) return null;
            return (
              <g key={conn.id}>
                {/* Invisible wider path for click target */}
                <path
                  d={arrowPath(from, to)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }}
                />
                <path
                  d={arrowPath(from, to)}
                  fill="none"
                  stroke="#4b5563"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                  className="pointer-events-none"
                />
              </g>
            );
          })}

          {/* Ghost line while connecting */}
          {connecting && (() => {
            const from = nodes.find((n) => n.id === connecting.fromId);
            if (!from) return null;
            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            return (
              <line
                x1={x1}
                y1={y1}
                x2={connecting.mx}
                y2={connecting.my}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="6 3"
                className="pointer-events-none"
              />
            );
          })()}

          {/* Nodes */}
          {nodes.map((node) => {
            const color = colorMap[node.type];
            return (
              <g
                key={node.id}
                onMouseDown={(e) => onNodeMouseDown(e, node.id)}
                onDoubleClick={(e) => { e.stopPropagation(); startEdit(node.id); }}
                className="cursor-grab active:cursor-grabbing"
              >
                {/* Shadow */}
                <rect
                  x={node.x + 2}
                  y={node.y + 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx="10"
                  fill="rgba(0,0,0,0.3)"
                />
                {/* Body */}
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx="10"
                  fill="#1f2937"
                  stroke={color}
                  strokeWidth="1.5"
                />
                {/* Icon */}
                <svg
                  x={node.x + 10}
                  y={node.y + (NODE_H - 16) / 2}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={iconMap[node.type]} />
                </svg>
                {/* Label */}
                {editingId === node.id ? (
                  <foreignObject
                    x={node.x + 30}
                    y={node.y + (NODE_H - 22) / 2}
                    width={NODE_W - 60}
                    height={22}
                  >
                    <input
                      autoFocus
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
                      className="w-full h-full bg-gray-800 border border-blue-500 rounded px-1 text-[11px] text-gray-200 outline-none"
                      style={{ fontSize: 11 }}
                    />
                  </foreignObject>
                ) : (
                  <text
                    x={node.x + 32}
                    y={node.y + NODE_H / 2 + 1}
                    fill="#e5e7eb"
                    fontSize="11"
                    fontFamily="inherit"
                    dominantBaseline="middle"
                  >
                    {node.label.length > 12 ? node.label.slice(0, 11) + "..." : node.label}
                  </text>
                )}

                {/* Delete button */}
                <g
                  onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                  className="cursor-pointer opacity-0 hover:opacity-100"
                  style={{ opacity: undefined }}
                >
                  <circle cx={node.x + NODE_W - 8} cy={node.y + 8} r="7" fill="#1f2937" stroke="#ef4444" strokeWidth="1" />
                  <text x={node.x + NODE_W - 8} y={node.y + 8} fill="#ef4444" fontSize="10" textAnchor="middle" dominantBaseline="central" fontWeight="bold">x</text>
                </g>

                {/* Output port (right edge) */}
                <circle
                  cx={node.x + NODE_W}
                  cy={node.y + NODE_H / 2}
                  r={PORT_R}
                  fill={connecting?.fromId === node.id ? "#3b82f6" : "#374151"}
                  stroke={color}
                  strokeWidth="1.5"
                  className="cursor-pointer hover:scale-125"
                  onClick={(e) => onPortClick(e, node.id)}
                />
                {/* Input port (left edge) */}
                <circle
                  cx={node.x}
                  cy={node.y + NODE_H / 2}
                  r={PORT_R}
                  fill={connecting ? "#3b82f6" : "#374151"}
                  stroke={color}
                  strokeWidth="1.5"
                  className={connecting && connecting.fromId !== node.id ? "cursor-pointer" : ""}
                  onClick={(e) => { if (connecting) onPortClick(e, node.id); }}
                  style={{ display: connecting ? undefined : "none" }}
                />
              </g>
            );
          })}
        </svg>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-gray-600">
              <p className="text-sm font-medium">Click a component above to start</p>
              <p className="text-xs mt-1">Drag nodes to position, click ports to connect</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
