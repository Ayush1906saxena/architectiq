"use client";

import { motion } from "framer-motion";

interface LoadBalancerProps {
  x: number;
  y: number;
  label: string;
  status?: "active" | "idle" | "highlighted";
  delay?: number;
}

export default function LoadBalancer({
  x,
  y,
  label,
  status = "active",
  delay = 0,
}: LoadBalancerProps) {
  const topWidth = 110;
  const bottomWidth = 60;
  const height = 60;

  const colors = {
    active: { fill: "#1e293b", stroke: "#a855f7", text: "#e2e8f0" },
    idle: { fill: "#1e293b", stroke: "#64748b", text: "#94a3b8" },
    highlighted: { fill: "#2e1065", stroke: "#c084fc", text: "#e9d5ff" },
  };

  const c = colors[status];

  // Trapezoid points (wider at top)
  const points = [
    `${-topWidth / 2},${-height / 2}`,
    `${topWidth / 2},${-height / 2}`,
    `${bottomWidth / 2},${height / 2}`,
    `${-bottomWidth / 2},${height / 2}`,
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
      {/* Trapezoid shape */}
      <polygon
        points={points}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={2}
      />

      {/* Distribution arrows inside */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: delay + 0.3, duration: 0.5 }}
      >
        {/* Center dot */}
        <circle cx={0} cy={-6} r={3} fill={c.stroke} />

        {/* Left arrow */}
        <line
          x1={0}
          y1={-3}
          x2={-16}
          y2={12}
          stroke={c.stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1={-16}
          y1={12}
          x2={-12}
          y2={8}
          stroke={c.stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Center arrow */}
        <line
          x1={0}
          y1={-3}
          x2={0}
          y2={14}
          stroke={c.stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1={0}
          y1={14}
          x2={4}
          y2={10}
          stroke={c.stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Right arrow */}
        <line
          x1={0}
          y1={-3}
          x2={16}
          y2={12}
          stroke={c.stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1={16}
          y1={12}
          x2={12}
          y2={8}
          stroke={c.stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </motion.g>

      {/* Label */}
      <text
        y={height / 2 + 18}
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
