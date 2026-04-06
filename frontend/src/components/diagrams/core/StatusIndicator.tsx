"use client";

import { motion } from "framer-motion";

interface StatusIndicatorProps {
  x: number;
  y: number;
  status: "healthy" | "degraded" | "down";
  label?: string;
  delay?: number;
}

export default function StatusIndicator({
  x,
  y,
  status,
  label,
  delay = 0,
}: StatusIndicatorProps) {
  const colors = {
    healthy: "#22c55e",
    degraded: "#f59e0b",
    down: "#ef4444",
  };

  const color = colors[status];

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.4 }}
    >
      {/* Pulse ring for live statuses */}
      {status === "healthy" && (
        <motion.circle
          cx={x}
          cy={y}
          r={6}
          fill="none"
          stroke={color}
          strokeWidth={2}
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: 0, scale: 2.5 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      )}

      {/* Degraded slow pulse */}
      {status === "degraded" && (
        <motion.circle
          cx={x}
          cy={y}
          r={6}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          initial={{ opacity: 0.4, scale: 1 }}
          animate={{ opacity: 0, scale: 2 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      )}

      {/* Main dot */}
      <circle cx={x} cy={y} r={5} fill={color} />

      {/* Inner highlight */}
      <circle cx={x - 1} cy={y - 1} r={1.5} fill="white" opacity={0.3} />

      {/* Label */}
      {label && (
        <text
          x={x + 12}
          y={y}
          dominantBaseline="central"
          fill={color}
          fontSize={10}
          fontFamily="monospace"
        >
          {label}
        </text>
      )}
    </motion.g>
  );
}
