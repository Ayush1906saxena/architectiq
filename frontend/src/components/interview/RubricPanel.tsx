"use client";

import { motion } from "framer-motion";

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
            return (
              <div key={dim}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-gray-400">{dim}</span>
                  <span className="text-[11px] font-mono text-gray-500">
                    {score.toFixed(1)}/10
                  </span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${getBarBg(score)}`}>
                  <motion.div
                    className={`h-full rounded-full ${getBarColor(score)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(score / 10) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
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
