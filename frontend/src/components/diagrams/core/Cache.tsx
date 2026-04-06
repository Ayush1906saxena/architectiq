"use client";

import { motion } from "framer-motion";

interface CacheProps {
  x: number;
  y: number;
  label: string;
  status?: "idle" | "hit" | "miss";
  delay?: number;
}

export default function Cache({
  x,
  y,
  label,
  status = "idle",
  delay = 0,
}: CacheProps) {
  const size = 44;

  const colors = {
    idle: { stroke: "#f59e0b", fill: "#1e293b", text: "#e2e8f0", glow: false },
    hit: { stroke: "#22c55e", fill: "#052e16", text: "#bbf7d0", glow: true },
    miss: { stroke: "#ef4444", fill: "#450a0a", text: "#fca5a5", glow: false },
  };

  const c = colors[status];

  // Diamond points (rotated square)
  const points = [
    `0,${-size}`,
    `${size},0`,
    `0,${size}`,
    `${-size},0`,
  ].join(" ");

  return (
    <motion.g
      initial={{ opacity: 0, y: y - 20 }}
      animate={{ opacity: 1, y }}
      transition={{
        opacity: { delay, duration: 0.5 },
        y: { delay, duration: 0.5, ease: "easeOut" },
      }}
    >
      {/* Glow effect for hit */}
      {c.glow && (
        <motion.polygon
          points={points}
          fill="none"
          stroke="#22c55e"
          strokeWidth={4}
          opacity={0}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          filter="url(#glow)"
        />
      )}

      {/* Miss flash */}
      {status === "miss" && (
        <motion.polygon
          points={points}
          fill="#ef4444"
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 0.5, repeat: 1 }}
        />
      )}

      {/* Diamond shape */}
      <polygon
        points={points}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={2}
      />

      {/* Lightning bolt icon */}
      <path
        d="M -4 -14 L 4 -2 L 0 -2 L 4 14 L -4 2 L 0 2 Z"
        fill={c.stroke}
        opacity={0.8}
      />

      {/* Label */}
      <text
        y={size + 18}
        textAnchor="middle"
        fill={c.text}
        fontSize={13}
        fontFamily="monospace"
      >
        {label}
      </text>

      {/* Status text */}
      {status !== "idle" && (
        <motion.text
          y={-size - 8}
          textAnchor="middle"
          fill={status === "hit" ? "#22c55e" : "#ef4444"}
          fontSize={11}
          fontFamily="monospace"
          fontWeight="bold"
          initial={{ opacity: 0, y: -size }}
          animate={{ opacity: 1, y: -size - 8 }}
          transition={{ duration: 0.3 }}
        >
          {status === "hit" ? "HIT" : "MISS"}
        </motion.text>
      )}
    </motion.g>
  );
}
