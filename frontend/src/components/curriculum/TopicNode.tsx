"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import MasteryBadge from "./MasteryBadge";

interface TopicNodeProps {
  slug: string;
  title: string;
  tier: string;
  masteryLevel: number;
  badge: string;
  lessonsCompleted: number;
  totalLessons: number;
  firstLessonId: string;
}

export default function TopicNode({
  slug,
  title,
  tier,
  masteryLevel,
  badge,
  lessonsCompleted,
  totalLessons,
  firstLessonId,
}: TopicNodeProps) {
  const progress = totalLessons > 0 ? lessonsCompleted / totalLessons : 0;
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        href={`/lesson/${slug}/${firstLessonId}`}
        className="group flex items-center gap-4 bg-gray-900 border border-gray-800 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 rounded-lg p-4 transition-all duration-200"
      >
        {/* Animated Progress ring */}
        <div className="relative flex-shrink-0">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="3" />
            <motion.circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke={progress === 1 ? "#22c55e" : "#3b82f6"}
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeLinecap="round"
              transform="rotate(-90 22 22)"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-gray-400">
            {Math.round(masteryLevel * 100)}%
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-gray-500 uppercase">{tier}</span>
            <MasteryBadge badge={badge} size="sm" />
          </div>
          <h3 className="text-sm font-medium text-gray-200 group-hover:text-white truncate transition-colors duration-200">
            {title}
          </h3>
          <p className="text-[11px] text-gray-500 font-mono">
            {lessonsCompleted}/{totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Animated Arrow */}
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0"
          whileHover={{ x: 3 }}
        >
          <path d="M6 3l5 5-5 5" />
        </motion.svg>
      </Link>
    </motion.div>
  );
}
