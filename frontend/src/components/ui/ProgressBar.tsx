"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  value: number; // 0 to 1
  color?: string;
  height?: number;
  showLabel?: boolean;
  className?: string;
  delay?: number;
}

export default function ProgressBar({
  value,
  color = "bg-blue-500",
  height = 6,
  showLabel = false,
  className = "",
  delay = 0,
}: ProgressBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div className={`w-full ${className}`}>
      <div
        className="w-full bg-gray-800 rounded-full overflow-hidden"
        style={{ height }}
      >
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{
            delay,
            duration: 0.8,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        />
      </div>
      {showLabel && (
        <motion.span
          className="text-[10px] text-gray-500 font-mono mt-1 block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.3 }}
        >
          {pct}%
        </motion.span>
      )}
    </div>
  );
}
