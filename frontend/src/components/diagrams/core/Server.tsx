"use client";

import { motion } from "framer-motion";

interface ServerProps {
  x: number;
  y: number;
  label: string;
  status?: "active" | "crashed" | "highlighted";
  delay?: number;
}

export default function Server({
  x,
  y,
  label,
  status = "active",
  delay = 0,
}: ServerProps) {
  const width = 100;
  const height = 70;

  const colors = {
    active: { fill: "#1e293b", stroke: "#3b82f6", text: "#e2e8f0" },
    crashed: { fill: "#450a0a", stroke: "#ef4444", text: "#fca5a5" },
    highlighted: { fill: "#172554", stroke: "#60a5fa", text: "#bfdbfe" },
  };

  const c = colors[status];

  return (
    <motion.g
      initial={{ opacity: 0, y: y - 20 }}
      animate={{
        opacity: status === "crashed" ? [1, 0.3] : 1,
        y: y,
        x: status === "crashed" ? [x, x - 3, x + 3, x - 2, x + 2, x] : x,
      }}
      transition={{
        opacity: { delay, duration: 0.5 },
        y: { delay, duration: 0.5, ease: "easeOut" },
        x: status === "crashed" ? { duration: 0.4, repeat: 0 } : undefined,
      }}
      filter={status === "crashed" ? "url(#crash-glow)" : undefined}
    >
      {/* Server box */}
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

      {/* Server icon (rack lines) */}
      <line
        x1={-width / 2 + 12}
        y1={-height / 2 + 18}
        x2={width / 2 - 12}
        y2={-height / 2 + 18}
        stroke={c.stroke}
        strokeWidth={1}
        opacity={0.5}
      />
      <line
        x1={-width / 2 + 12}
        y1={-height / 2 + 28}
        x2={width / 2 - 12}
        y2={-height / 2 + 28}
        stroke={c.stroke}
        strokeWidth={1}
        opacity={0.5}
      />

      {/* Status LED */}
      <circle
        cx={width / 2 - 15}
        cy={-height / 2 + 12}
        r={4}
        fill={status === "crashed" ? "#ef4444" : "#22c55e"}
      />

      {/* Label */}
      <text
        y={height / 2 - 12}
        textAnchor="middle"
        fill={c.text}
        fontSize={13}
        fontFamily="monospace"
      >
        {label}
      </text>

      {/* Crash X */}
      {status === "crashed" && (
        <motion.g
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <line
            x1={-20}
            y1={-15}
            x2={20}
            y2={15}
            stroke="#ef4444"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <line
            x1={20}
            y1={-15}
            x2={-20}
            y2={15}
            stroke="#ef4444"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </motion.g>
      )}
    </motion.g>
  );
}
