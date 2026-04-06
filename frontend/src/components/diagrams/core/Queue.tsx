"use client";

import { motion } from "framer-motion";

interface QueueProps {
  x: number;
  y: number;
  label: string;
  messageCount?: number;
  delay?: number;
}

export default function Queue({
  x,
  y,
  label,
  messageCount = 3,
  delay = 0,
}: QueueProps) {
  const width = 140;
  const height = 50;
  const blockSize = 14;
  const blockGap = 4;
  const maxBlocks = 6;
  const visibleBlocks = Math.min(messageCount, maxBlocks);

  return (
    <motion.g
      initial={{ opacity: 0, y: y - 20 }}
      animate={{ opacity: 1, y }}
      transition={{
        opacity: { delay, duration: 0.5 },
        y: { delay, duration: 0.5, ease: "easeOut" },
      }}
    >
      {/* Queue container */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={6}
        fill="#1e293b"
        stroke="#ec4899"
        strokeWidth={2}
      />

      {/* Entry arrow (left) */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: delay + 0.3, duration: 0.4 }}
      >
        <line
          x1={-width / 2 + 6}
          y1={0}
          x2={-width / 2 + 14}
          y2={0}
          stroke="#ec4899"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <polygon
          points={`${-width / 2 + 14},-3 ${-width / 2 + 18},0 ${-width / 2 + 14},3`}
          fill="#ec4899"
        />
      </motion.g>

      {/* Exit arrow (right) */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: delay + 0.3, duration: 0.4 }}
      >
        <line
          x1={width / 2 - 18}
          y1={0}
          x2={width / 2 - 6}
          y2={0}
          stroke="#ec4899"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <polygon
          points={`${width / 2 - 6},-3 ${width / 2 - 2},0 ${width / 2 - 6},3`}
          fill="#ec4899"
        />
      </motion.g>

      {/* Message blocks */}
      {Array.from({ length: visibleBlocks }).map((_, i) => {
        const startX = -((visibleBlocks * (blockSize + blockGap)) / 2) + blockGap / 2;
        const bx = startX + i * (blockSize + blockGap);

        return (
          <motion.rect
            key={i}
            x={bx}
            y={-blockSize / 2}
            width={blockSize}
            height={blockSize}
            rx={2}
            fill="#ec4899"
            opacity={0.6}
            initial={{ opacity: 0, x: bx - 20 }}
            animate={{ opacity: 0.6, x: bx }}
            transition={{
              delay: delay + 0.4 + i * 0.1,
              duration: 0.3,
              ease: "easeOut",
            }}
          />
        );
      })}

      {/* Label */}
      <text
        y={height / 2 + 18}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize={13}
        fontFamily="monospace"
      >
        {label}
      </text>

      {/* Message count */}
      {messageCount > 0 && (
        <text
          x={width / 2 - 8}
          y={-height / 2 - 6}
          textAnchor="middle"
          fill="#ec4899"
          fontSize={10}
          fontFamily="monospace"
          opacity={0.7}
        >
          {messageCount}
        </text>
      )}
    </motion.g>
  );
}
