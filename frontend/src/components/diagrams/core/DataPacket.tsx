"use client";

import { motion } from "framer-motion";

interface DataPacketProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label: string;
  formula: string;
  delay?: number;
  duration?: number;
  color?: string;
  onComplete?: () => void;
}

export default function DataPacket({
  fromX,
  fromY,
  toX,
  toY,
  label,
  formula,
  delay = 0,
  duration = 1.2,
  color = "#3b82f6",
  onComplete,
}: DataPacketProps) {
  return (
    <motion.g
      initial={{ x: fromX, y: fromY, opacity: 0 }}
      animate={{
        x: [fromX, fromX, toX],
        y: [fromY, fromY, toY],
        opacity: [0, 1, 1],
      }}
      transition={{
        delay,
        duration: duration,
        times: [0, 0.15, 1],
        ease: "easeInOut",
      }}
      onAnimationComplete={onComplete}
    >
      {/* Packet circle */}
      <circle r={14} fill={color} opacity={0.9} />
      <circle r={14} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />

      {/* Data label */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={10}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {label}
      </text>

      {/* Formula above */}
      <motion.text
        y={-22}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={11}
        fontFamily="monospace"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + duration * 0.3 }}
      >
        {formula}
      </motion.text>
    </motion.g>
  );
}
