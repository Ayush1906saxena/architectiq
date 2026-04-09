"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const RUBRIC_DIMENSIONS = [
  "Requirements Gathering",
  "High-Level Design",
  "Data Model",
  "API Design",
  "Scalability",
  "Reliability",
  "Trade-off Analysis",
  "Communication",
];

interface InterviewState {
  phase: string;
  exchange_count: number;
  elapsed_minutes: number;
  total_minutes: number;
  effective_difficulty: number;
  level: string;
  concepts_covered: number;
  concepts_total: number;
  rubric_scores: Record<string, number>;
  deep_dive_target: string | null;
  contradictions_found: number;
}

interface RubricPanelProps {
  state: InterviewState;
}

function getBarColor(score: number): string {
  if (score < 4) return "bg-red-500";
  if (score < 7) return "bg-amber-500";
  return "bg-green-500";
}

function getBarBg(score: number): string {
  if (score < 4) return "bg-red-500/10";
  if (score < 7) return "bg-amber-500/10";
  return "bg-green-500/10";
}

export default function RubricPanel({ state }: RubricPanelProps) {
  const scores = state.rubric_scores || {};
  const prevScoresRef = useRef<Record<string, number>>({});
  const [changedDims, setChangedDims] = useState<Record<string, number>>({});

  useEffect(() => {
    const prev = prevScoresRef.current;
    const changes: Record<string, number> = {};

    for (const dim of RUBRIC_DIMENSIONS) {
      const key = dim.toLowerCase().replace(/[\s-]/g, "_");
      const current = scores[key] ?? scores[dim] ?? 0;
      const previous = prev[key] ?? 0;
      if (previous !== 0 && current !== previous) {
        changes[key] = current - previous;
      }
    }

    if (Object.keys(changes).length > 0) {
      setChangedDims(changes);
      const timer = setTimeout(() => setChangedDims({}), 2000);
      // Save current scores as previous
      const snapshot: Record<string, number> = {};
      for (const dim of RUBRIC_DIMENSIONS) {
        const key = dim.toLowerCase().replace(/[\s-]/g, "_");
        snapshot[key] = scores[key] ?? scores[dim] ?? 0;
      }
      prevScoresRef.current = snapshot;
      return () => clearTimeout(timer);
    }

    // Always update previous scores
    const snapshot: Record<string, number> = {};
    for (const dim of RUBRIC_DIMENSIONS) {
      const key = dim.toLowerCase().replace(/[\s-]/g, "_");
      snapshot[key] = scores[key] ?? scores[dim] ?? 0;
    }
    prevScoresRef.current = snapshot;
  }, [scores]);

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-4">
      {/* Phase info */}
      <div className="bg-gray-800/50 rounded-lg p-3">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Current Phase</div>
        <div className="text-sm text-blue-400 font-medium capitalize">
          {state.phase?.replace(/_/g, " ") || "Starting"}
        </div>
      </div>

      {/* Difficulty meter */}
      <div className="bg-gray-800/50 rounded-lg p-3">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Difficulty</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(state.effective_difficulty / 10) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-xs text-gray-400 font-mono w-8 text-right">
            {state.effective_difficulty?.toFixed(1) || "0"}
          </span>
        </div>
      </div>

      {/* Concepts covered */}
      <div className="bg-gray-800/50 rounded-lg p-3">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Concepts Covered</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: `${state.concepts_total > 0 ? (state.concepts_covered / state.concepts_total) * 100 : 0}%`,
              }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {state.concepts_covered}/{state.concepts_total}
          </span>
        </div>
      </div>

      {/* Contradictions */}
      {state.contradictions_found > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Contradictions Found</div>
          <div className="text-sm text-red-300 font-mono">{state.contradictions_found}</div>
        </div>
      )}

      {/* Rubric scores */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Rubric Scores</div>
        <div className="space-y-2.5">
          {RUBRIC_DIMENSIONS.map((dim) => {
            const key = dim.toLowerCase().replace(/[\s-]/g, "_");
            const score = scores[key] ?? scores[dim] ?? 0;
            const delta = changedDims[key];
            const hasChanged = delta !== undefined;
            const isIncrease = hasChanged && delta > 0;
            return (
              <motion.div
                key={dim}
                animate={
                  hasChanged && isIncrease
                    ? { backgroundColor: ["rgba(34,197,94,0.15)", "rgba(34,197,94,0)"] }
                    : hasChanged
                    ? { backgroundColor: ["rgba(239,68,68,0.12)", "rgba(239,68,68,0)"] }
                    : {}
                }
                transition={{ duration: 1.5 }}
                className="rounded-md px-1.5 py-1 -mx-1.5"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-gray-400">{dim}</span>
                  <div className="flex items-center gap-1.5">
                    <AnimatePresence>
                      {hasChanged && (
                        <motion.span
                          initial={{ opacity: 0, x: 6, scale: 0.8 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -4, scale: 0.8 }}
                          transition={{ duration: 0.3 }}
                          className={`text-[10px] font-mono font-semibold ${
                            isIncrease ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {isIncrease ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <span className="text-[11px] font-mono text-gray-500">
                      {score.toFixed(1)}/10
                    </span>
                  </div>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${getBarBg(score)}`}>
                  <motion.div
                    className={`h-full rounded-full ${getBarColor(score)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(score / 10) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Deep dive target */}
      {state.deep_dive_target && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Deep Dive Target</div>
          <div className="text-sm text-amber-400 font-medium">{state.deep_dive_target}</div>
        </div>
      )}
    </div>
  );
}
