"use client";

import { motion } from "framer-motion";

interface DifficultyMeterProps {
  difficulty: number;
  maxDifficulty?: number;
}

function getSegmentColor(segIndex: number, current: number): string {
  if (segIndex >= current) return "bg-gray-700/50";
  const ratio = segIndex / 9;
  if (ratio < 0.35) return "bg-green-500";
  if (ratio < 0.65) return "bg-yellow-500";
  return "bg-red-500";
}

export default function DifficultyMeter({
  difficulty,
  maxDifficulty = 10,
}: DifficultyMeterProps) {
  const clamped = Math.max(1, Math.min(maxDifficulty, difficulty));

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-400 whitespace-nowrap">
        Difficulty: <span className="text-gray-200 font-semibold">{clamped}/{maxDifficulty}</span>
      </span>
      <div className="flex gap-1">
        {Array.from({ length: maxDifficulty }).map((_, i) => (
          <motion.div
            key={i}
            className={`h-2.5 w-5 rounded-sm ${getSegmentColor(i, clamped)}`}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.04, duration: 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}
