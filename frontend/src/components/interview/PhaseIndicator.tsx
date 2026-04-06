"use client";

import { motion } from "framer-motion";

const PHASES = [
  { key: "requirements", label: "Requirements" },
  { key: "high_level", label: "High Level" },
  { key: "deep_dive", label: "Deep Dive" },
  { key: "scaling", label: "Scaling" },
  { key: "wrap_up", label: "Wrap Up" },
];

interface PhaseIndicatorProps {
  currentPhase: string;
}

export default function PhaseIndicator({ currentPhase }: PhaseIndicatorProps) {
  const currentIndex = PHASES.findIndex(
    (p) => p.key === currentPhase.toLowerCase().replace(/[\s-]/g, "_")
  );

  return (
    <div className="flex items-center gap-2">
      {PHASES.map((phase, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={phase.key} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                className={`w-3 h-3 rounded-full border-2 ${
                  isCompleted
                    ? "bg-green-500 border-green-500"
                    : isCurrent
                    ? "bg-blue-500 border-blue-500"
                    : "bg-transparent border-gray-600"
                }`}
                animate={
                  isCurrent
                    ? { scale: [1, 1.2, 1], boxShadow: ["0 0 0px rgba(59,130,246,0)", "0 0 8px rgba(59,130,246,0.5)", "0 0 0px rgba(59,130,246,0)"] }
                    : {}
                }
                transition={isCurrent ? { duration: 2, repeat: Infinity } : {}}
              />
              <span
                className={`text-[9px] font-mono whitespace-nowrap ${
                  isCompleted
                    ? "text-green-400"
                    : isCurrent
                    ? "text-blue-400"
                    : "text-gray-600"
                }`}
              >
                {phase.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div
                className={`w-6 h-px mb-4 ${
                  i < currentIndex ? "bg-green-500" : "bg-gray-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
