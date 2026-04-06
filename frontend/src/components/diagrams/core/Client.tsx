"use client";

import { motion } from "framer-motion";

interface ClientProps {
  x: number;
  y: number;
  label: string;
  status?: "active" | "idle" | "highlighted";
  delay?: number;
}

export default function Client({
  x,
  y,
  label,
  status = "active",
  delay = 0,
}: ClientProps) {
  const width = 100;
  const height = 70;

  const colors = {
    active: { fill: "#1e293b", stroke: "#8b5cf6", text: "#e2e8f0" },
    idle: { fill: "#1e293b", stroke: "#64748b", text: "#94a3b8" },
    highlighted: { fill: "#2e1065", stroke: "#a78bfa", text: "#e9d5ff" },
  };

  const c = colors[status];

  return (
    <motion.g
      initial={{ opacity: 0, y: y - 20 }}
      animate={{ opacity: 1, y }}
      transition={{
        opacity: { delay, duration: 0.5 },
        y: { delay, duration: 0.5, ease: "easeOut" },
      }}
    >
      {/* Browser window */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={8}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={2}
      />

      {/* Browser top bar */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={20}
        rx={8}
        fill={c.stroke}
        opacity={0.15}
      />
      {/* Cover bottom corners of top bar */}
      <rect
        x={-width / 2}
        y={-height / 2 + 12}
        width={width}
        height={8}
        fill={c.stroke}
        opacity={0.15}
      />

      {/* Three browser dots */}
      <circle cx={-width / 2 + 15} cy={-height / 2 + 10} r={3} fill="#ef4444" opacity={0.8} />
      <circle cx={-width / 2 + 25} cy={-height / 2 + 10} r={3} fill="#f59e0b" opacity={0.8} />
      <circle cx={-width / 2 + 35} cy={-height / 2 + 10} r={3} fill="#22c55e" opacity={0.8} />

      {/* Content lines (representing a webpage) */}
      <line
        x1={-width / 2 + 12}
        y1={-height / 2 + 30}
        x2={width / 2 - 12}
        y2={-height / 2 + 30}
        stroke={c.stroke}
        strokeWidth={1}
        opacity={0.3}
      />
      <line
        x1={-width / 2 + 12}
        y1={-height / 2 + 38}
        x2={width / 2 - 24}
        y2={-height / 2 + 38}
        stroke={c.stroke}
        strokeWidth={1}
        opacity={0.2}
      />

      {/* Label */}
      <text
        y={height / 2 - 8}
        textAnchor="middle"
        fill={c.text}
        fontSize={13}
        fontFamily="monospace"
      >
        {label}
      </text>
    </motion.g>
  );
}
