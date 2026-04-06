"use client";

import { motion } from "framer-motion";

interface NetworkPartitionProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay?: number;
}

export default function NetworkPartition({
  x1,
  y1,
  x2,
  y2,
  delay = 0,
}: NetworkPartitionProps) {
  // Create a jagged path between two points
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const segments = Math.max(6, Math.floor(length / 20));

  // Perpendicular direction for jagged offsets
  const nx = -dy / length;
  const ny = dx / length;
  const jagAmount = 10;

  let pathD = `M ${x1} ${y1}`;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const offset = (i % 2 === 0 ? 1 : -1) * jagAmount;
    pathD += ` L ${px + nx * offset} ${py + ny * offset}`;
  }
  pathD += ` L ${x2} ${y2}`;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.4 }}
    >
      {/* Jagged partition line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke="#ef4444"
        strokeWidth={3}
        strokeDasharray="8 6"
        strokeLinecap="round"
        initial={{ strokeDashoffset: 40 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Faint glow behind */}
      <motion.path
        d={pathD}
        fill="none"
        stroke="#ef4444"
        strokeWidth={8}
        strokeLinecap="round"
        opacity={0.15}
        strokeDasharray="8 6"
        initial={{ strokeDashoffset: 40 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Partition label */}
      <text
        x={(x1 + x2) / 2}
        y={(y1 + y2) / 2 - 14}
        textAnchor="middle"
        fill="#ef4444"
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
        opacity={0.8}
      >
        PARTITION
      </text>
    </motion.g>
  );
}
