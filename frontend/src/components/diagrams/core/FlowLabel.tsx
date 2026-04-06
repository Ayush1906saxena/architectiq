"use client";

import { motion } from "framer-motion";

interface FlowLabelProps {
  x: number;
  y: number;
  text: string;
  color?: string;
  fontSize?: number;
  background?: boolean;
}

export default function FlowLabel({
  x,
  y,
  text,
  color = "#94a3b8",
  fontSize = 12,
  background = false,
}: FlowLabelProps) {
  const paddingX = 10;
  const paddingY = 5;
  const estimatedWidth = text.length * fontSize * 0.62 + paddingX * 2;
  const height = fontSize + paddingY * 2;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {background && (
        <rect
          x={x - estimatedWidth / 2}
          y={y - height / 2}
          width={estimatedWidth}
          height={height}
          rx={height / 2}
          fill="#0f172a"
          opacity={0.85}
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.3}
        />
      )}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={fontSize}
        fontFamily="monospace"
      >
        {text}
      </text>
    </motion.g>
  );
}
