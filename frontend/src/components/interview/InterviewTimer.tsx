"use client";

import { motion } from "framer-motion";

interface InterviewTimerProps {
  totalMinutes: number;
  elapsedMinutes: number;
}

export default function InterviewTimer({ totalMinutes, elapsedMinutes }: InterviewTimerProps) {
  const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes);
  const mins = Math.floor(remainingMinutes);
  const secs = Math.round((remainingMinutes - mins) * 60);

  const colorClass =
    remainingMinutes > 10
      ? "text-white"
      : remainingMinutes > 5
      ? "text-amber-400"
      : "text-red-400";

  const shouldPulse = remainingMinutes < 5;

  return (
    <motion.div
      className={`font-mono text-lg font-bold tabular-nums ${colorClass}`}
      animate={shouldPulse ? { opacity: [1, 0.5, 1] } : {}}
      transition={shouldPulse ? { duration: 1, repeat: Infinity } : {}}
    >
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </motion.div>
  );
}
