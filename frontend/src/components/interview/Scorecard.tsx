"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface ScorecardData {
  overall_score: number;
  passed: boolean;
  pass_threshold: number;
  badge: string;
  level_attempted: string;
  level_assessed: string;
  rubric_scores: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  recommended_lessons: { topic_id: string; title: string }[];
  exchange_count: number;
  concepts_covered: number;
  concepts_total: number;
  duration_minutes: number;
  contradictions_found: number;
}

interface ScorecardProps {
  scorecard: ScorecardData;
  onTryAgain: () => void;
}

const RUBRIC_LABELS = [
  "Requirements Gathering",
  "High-Level Design",
  "Data Model",
  "API Design",
  "Scalability",
  "Reliability",
  "Trade-off Analysis",
  "Communication",
];

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function getBadgeInfo(badge: string): { label: string; color: string; bg: string } {
  switch (badge?.toLowerCase()) {
    case "diamond":
      return { label: "Diamond", color: "text-cyan-300", bg: "bg-cyan-500/10 border-cyan-500/30" };
    case "gold":
      return { label: "Gold", color: "text-yellow-300", bg: "bg-yellow-500/10 border-yellow-500/30" };
    case "silver":
      return { label: "Silver", color: "text-gray-300", bg: "bg-gray-400/10 border-gray-400/30" };
    case "bronze":
      return { label: "Bronze", color: "text-orange-300", bg: "bg-orange-500/10 border-orange-500/30" };
    default:
      return { label: "None", color: "text-gray-500", bg: "bg-gray-800 border-gray-700" };
  }
}

function RadarChart({ scores }: { scores: Record<string, number> }) {
  const dims = RUBRIC_LABELS;
  const count = dims.length;
  const cx = 120;
  const cy = 120;
  const maxR = 100;

  const angleStep = (2 * Math.PI) / count;

  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 10) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const gridLevels = [2.5, 5, 7.5, 10];

  const scoreValues = dims.map((dim) => {
    const key = dim.toLowerCase().replace(/[\s-]/g, "_");
    return scores[key] ?? scores[dim] ?? 0;
  });

  const polygonPoints = scoreValues
    .map((val, i) => {
      const p = getPoint(i, val);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[280px] mx-auto">
      {/* Grid */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={Array.from({ length: count }, (_, i) => {
            const p = getPoint(i, level);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none"
          stroke="#374151"
          strokeWidth="0.5"
        />
      ))}

      {/* Axes */}
      {dims.map((_, i) => {
        const p = getPoint(i, 10);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#374151"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Labels */}
      {dims.map((dim, i) => {
        const p = getPoint(i, 12.5);
        return (
          <text
            key={dim}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-500"
            fontSize="7"
          >
            {dim.length > 14 ? dim.slice(0, 12) + ".." : dim}
          </text>
        );
      })}

      {/* Score polygon */}
      <motion.polygon
        points={polygonPoints}
        fill="rgba(59, 130, 246, 0.15)"
        stroke="#3b82f6"
        strokeWidth="1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />

      {/* Score dots */}
      {scoreValues.map((val, i) => {
        const p = getPoint(i, val);
        return (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#3b82f6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.05 }}
          />
        );
      })}
    </svg>
  );
}

export default function Scorecard({ scorecard, onTryAgain }: ScorecardProps) {
  const badgeInfo = getBadgeInfo(scorecard.badge);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="w-full max-w-3xl mx-4 space-y-4"
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {/* Overall Score */}
        <Card hover={false} className="p-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          >
            <div className={`text-7xl font-bold ${getScoreColor(scorecard.overall_score)}`}>
              {scorecard.overall_score}
            </div>
            <div className="text-gray-500 text-sm mt-1">out of 100</div>
          </motion.div>

          <div className="flex items-center justify-center gap-4 mt-5">
            {/* Pass/Fail */}
            <motion.span
              className={`px-3 py-1 rounded-full text-sm font-medium border ${
                scorecard.passed
                  ? "text-green-400 bg-green-500/10 border-green-500/30"
                  : "text-red-400 bg-red-500/10 border-red-500/30"
              }`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              {scorecard.passed ? "PASS" : "FAIL"} (threshold: {scorecard.pass_threshold})
            </motion.span>

            {/* Badge */}
            <motion.span
              className={`px-3 py-1 rounded-full text-sm font-medium border ${badgeInfo.bg} ${badgeInfo.color}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
            >
              {badgeInfo.label} Badge
            </motion.span>
          </div>

          {/* Levels */}
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-500">
            <span>
              Attempted: <span className="text-gray-300 font-medium">{scorecard.level_attempted}</span>
            </span>
            <span>
              Assessed: <span className="text-blue-400 font-medium">{scorecard.level_assessed}</span>
            </span>
          </div>
        </Card>

        {/* Radar Chart + Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card hover={false} className="p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Rubric Breakdown</h3>
            <RadarChart scores={scorecard.rubric_scores} />
          </Card>

          <Card hover={false} className="p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Interview Stats</h3>
            <div className="space-y-3">
              {[
                { label: "Exchanges", value: scorecard.exchange_count },
                { label: "Concepts Covered", value: `${scorecard.concepts_covered}/${scorecard.concepts_total}` },
                { label: "Duration", value: `${scorecard.duration_minutes} min` },
                { label: "Contradictions", value: scorecard.contradictions_found },
              ].map((stat) => (
                <div key={stat.label} className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{stat.label}</span>
                  <span className="text-sm text-gray-200 font-mono">{stat.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card hover={false} className="p-6">
            <h3 className="text-sm font-medium text-green-400 mb-3">Strengths</h3>
            <ul className="space-y-2">
              {(scorecard.strengths || []).map((s, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-300"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                >
                  <span className="text-green-500 mt-0.5">+</span>
                  {s}
                </motion.li>
              ))}
            </ul>
          </Card>

          <Card hover={false} className="p-6">
            <h3 className="text-sm font-medium text-red-400 mb-3">Areas for Improvement</h3>
            <ul className="space-y-2">
              {(scorecard.weaknesses || []).map((w, i) => (
                <motion.li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-300"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                >
                  <span className="text-red-500 mt-0.5">-</span>
                  {w}
                </motion.li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Recommended Lessons */}
        {scorecard.recommended_lessons?.length > 0 && (
          <Card hover={false} className="p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Recommended Lessons</h3>
            <div className="flex flex-wrap gap-2">
              {scorecard.recommended_lessons.map((lesson) => (
                <Link
                  key={lesson.topic_id}
                  href={`/lesson/${lesson.topic_id}`}
                  className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  {lesson.title}
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 pt-2 pb-4">
          <Button variant="primary" size="lg" onClick={onTryAgain}>
            Try Again
          </Button>
          <Link href="/interview">
            <Button variant="secondary" size="lg">
              Back to Interview Selection
            </Button>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
