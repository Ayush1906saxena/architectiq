"use client";

import { motion } from "framer-motion";

interface DatabaseProps {
  x: number;
  y: number;
  label: string;
  status?: "active" | "crashed" | "replicated";
  delay?: number;
  variant?: "primary" | "replica";
}

export default function Database({
  x,
  y,
  label,
  status = "active",
  delay = 0,
  variant = "primary",
}: DatabaseProps) {
  const width = 90;
  const height = 70;
  const ellipseRy = 12;

  const variantColors = {
    primary: { stroke: "#22c55e", fill: "#1e293b", text: "#e2e8f0" },
    replica: { stroke: "#06b6d4", fill: "#1e293b", text: "#e2e8f0" },
  };

  const statusOverrides = {
    active: {},
    crashed: { stroke: "#ef4444", fill: "#450a0a", text: "#fca5a5" },
    replicated: {},
  };

  const base = variantColors[variant];
  const overrides = statusOverrides[status];
  const c = { ...base, ...overrides };

  return (
    <motion.g
      initial={{ opacity: 0, y: y - 20 }}
      animate={{
        opacity: status === "crashed" ? [1, 0.3] : 1,
        y,
        x: status === "crashed" ? [x, x - 3, x + 3, x - 2, x + 2, x] : x,
      }}
      transition={{
        opacity: { delay, duration: 0.5 },
        y: { delay, duration: 0.5, ease: "easeOut" },
        x: status === "crashed" ? { duration: 0.4, repeat: 0 } : undefined,
      }}
      filter={status === "crashed" ? "url(#crash-glow)" : undefined}
    >
      {/* Cylinder body */}
      <rect
        x={-width / 2}
        y={-height / 2 + ellipseRy}
        width={width}
        height={height - ellipseRy * 2}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={2}
      />

      {/* Left and right edges of body (hide rect side strokes to form cylinder) */}
      <rect
        x={-width / 2 + 1}
        y={-height / 2 + ellipseRy}
        width={width - 2}
        height={height - ellipseRy * 2}
        fill={c.fill}
      />
      <line
        x1={-width / 2}
        y1={-height / 2 + ellipseRy}
        x2={-width / 2}
        y2={height / 2 - ellipseRy}
        stroke={c.stroke}
        strokeWidth={2}
      />
      <line
        x1={width / 2}
        y1={-height / 2 + ellipseRy}
        x2={width / 2}
        y2={height / 2 - ellipseRy}
        stroke={c.stroke}
        strokeWidth={2}
      />

      {/* Bottom ellipse */}
      <ellipse
        cx={0}
        cy={height / 2 - ellipseRy}
        rx={width / 2}
        ry={ellipseRy}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={2}
      />

      {/* Top ellipse */}
      <ellipse
        cx={0}
        cy={-height / 2 + ellipseRy}
        rx={width / 2}
        ry={ellipseRy}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={2}
      />

      {/* Data rows inside cylinder */}
      <line
        x1={-width / 2 + 14}
        y1={-2}
        x2={width / 2 - 14}
        y2={-2}
        stroke={c.stroke}
        strokeWidth={1}
        opacity={0.3}
      />
      <line
        x1={-width / 2 + 14}
        y1={8}
        x2={width / 2 - 14}
        y2={8}
        stroke={c.stroke}
        strokeWidth={1}
        opacity={0.2}
      />

      {/* Status indicator */}
      <circle
        cx={width / 2 - 10}
        cy={-height / 2 + ellipseRy}
        r={4}
        fill={
          status === "crashed"
            ? "#ef4444"
            : status === "replicated"
              ? "#06b6d4"
              : "#22c55e"
        }
      />

      {/* Replica badge */}
      {variant === "replica" && (
        <text
          x={-width / 2 + 10}
          y={-height / 2 + ellipseRy + 4}
          fill="#06b6d4"
          fontSize={9}
          fontFamily="monospace"
          opacity={0.7}
        >
          R
        </text>
      )}

      {/* Label */}
      <text
        y={height / 2 + 16}
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
            x1={-18}
            y1={-10}
            x2={18}
            y2={10}
            stroke="#ef4444"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <line
            x1={18}
            y1={-10}
            x2={-18}
            y2={10}
            stroke="#ef4444"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </motion.g>
      )}
    </motion.g>
  );
}
