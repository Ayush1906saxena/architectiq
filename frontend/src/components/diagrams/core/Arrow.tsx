"use client";

import { motion } from "framer-motion";

interface ArrowProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color?: string;
  label?: string;
  animated?: boolean;
  delay?: number;
  dashed?: boolean;
}

export default function Arrow({
  fromX,
  fromY,
  toX,
  toY,
  color = "#94a3b8",
  label,
  animated = false,
  delay = 0,
  dashed = false,
}: ArrowProps) {
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.5 }}
    >
      <motion.line
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? "6 4" : animated ? "8 4" : "none"}
        markerEnd="url(#arrowhead)"
        initial={animated ? { strokeDashoffset: 40 } : undefined}
        animate={animated ? { strokeDashoffset: 0 } : undefined}
        transition={
          animated
            ? { duration: 1.5, repeat: Infinity, ease: "linear" }
            : undefined
        }
      />

      {label && (
        <text
          x={midX}
          y={midY - 8}
          textAnchor="middle"
          fill={color}
          fontSize={11}
          fontFamily="monospace"
        >
          {label}
        </text>
      )}
    </motion.g>
  );
}
