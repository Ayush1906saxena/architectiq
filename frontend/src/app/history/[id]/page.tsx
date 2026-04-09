"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchInterviewReplay } from "@/lib/api";
import { motion } from "framer-motion";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

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

interface ReplayData {
  id: number;
  problem_id: string;
  career_level: string;
  overall_score: number | null;
  passed: boolean | null;
  badge: string | null;
  scorecard: ScorecardData | null;
  transcript: Message[];
  started_at: string;
  completed_at: string | null;
}

const RUBRIC_LABELS: Record<string, string> = {
  requirements_gathering: "Requirements Gathering",
  capacity_estimation: "Capacity Estimation",
  api_design: "API Design",
  database_design: "Database Design",
  caching_strategy: "Caching Strategy",
  scalability: "Scalability",
  failure_handling: "Failure Handling",
  communication: "Communication",
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function getBadgeStyle(badge: string | null): string {
  switch (badge?.toLowerCase()) {
    case "diamond":
      return "text-cyan-300 bg-cyan-500/10 border-cyan-500/30";
    case "gold":
      return "text-yellow-300 bg-yellow-500/10 border-yellow-500/30";
    case "silver":
      return "text-gray-300 bg-gray-400/10 border-gray-400/30";
    case "bronze":
      return "text-orange-300 bg-orange-500/10 border-orange-500/30";
    default:
      return "text-gray-500 bg-gray-800 border-gray-700";
  }
}

export default function InterviewReplayPage() {
  const params = useParams();
  const historyId = Number(params.id);
  const { user, isLoading: authLoading } = useAuthStore();
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const replay = await fetchInterviewReplay(historyId);
        setData(replay);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load replay");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, authLoading, historyId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading replay...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-200 mb-2">Sign in to view replay</h2>
          <p className="text-gray-400 mb-6 text-sm">You need to be signed in to view interview replays.</p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/history">
            <Button variant="secondary">Back to History</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const problemTitle = data.problem_id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const scorecard = data.scorecard;
  const transcript = data.transcript || [];

  return (
    <div className="min-h-screen bg-gray-950 p-6 md:p-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-4xl mx-auto"
      >
        {/* Back button */}
        <Link
          href="/history"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to History
        </Link>

        {/* Header */}
        <Card hover={false} className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">{problemTitle}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-500 capitalize">{data.career_level}</span>
                <span className="text-xs text-gray-600">
                  {new Date(data.started_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                {data.completed_at && (
                  <span className="text-xs text-gray-600">
                    {new Date(data.completed_at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {data.overall_score !== null && (
                <span className={`text-3xl font-bold ${getScoreColor(data.overall_score)}`}>
                  {data.overall_score}%
                </span>
              )}
              {data.badge && (
                <span
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border capitalize ${getBadgeStyle(data.badge)}`}
                >
                  {data.badge}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Transcript */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
            Interview Transcript
          </h2>

          {transcript.length === 0 ? (
            <Card hover={false} className="p-8 text-center">
              <p className="text-gray-500 text-sm">No transcript available for this interview.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {transcript.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 1.5) }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-900 border border-gray-800 text-gray-200"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <span className="text-[10px] text-blue-400 font-mono block mb-1">
                        Interviewer
                      </span>
                    )}
                    {msg.role === "user" && (
                      <span className="text-[10px] text-blue-200 font-mono block mb-1">
                        You
                      </span>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Scorecard Summary */}
        {scorecard && (
          <div className="space-y-4 mb-8">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Scorecard
            </h2>

            {/* Overall + Badge */}
            <Card hover={false} className="p-6 text-center">
              <div className={`text-5xl font-bold ${getScoreColor(scorecard.overall_score)}`}>
                {scorecard.overall_score}
              </div>
              <div className="text-gray-500 text-sm mt-1">out of 100</div>
              <div className="flex items-center justify-center gap-4 mt-4">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${
                    scorecard.passed
                      ? "text-green-400 bg-green-500/10 border-green-500/30"
                      : "text-red-400 bg-red-500/10 border-red-500/30"
                  }`}
                >
                  {scorecard.passed ? "PASS" : "FAIL"} (threshold: {scorecard.pass_threshold})
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium border capitalize ${getBadgeStyle(scorecard.badge)}`}
                >
                  {scorecard.badge || "None"} Badge
                </span>
              </div>
              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-500">
                <span>
                  Attempted: <span className="text-gray-300 font-medium">{scorecard.level_attempted}</span>
                </span>
                <span>
                  Assessed: <span className="text-blue-400 font-medium">{scorecard.level_assessed}</span>
                </span>
              </div>
            </Card>

            {/* Rubric Scores + Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card hover={false} className="p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-4">Rubric Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(scorecard.rubric_scores || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-36 truncate">
                        {RUBRIC_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-blue-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(value / 10) * 100}%` }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                        />
                      </div>
                      <span className="text-xs text-gray-300 font-mono w-8 text-right">
                        {typeof value === "number" ? value.toFixed(1) : value}
                      </span>
                    </div>
                  ))}
                </div>
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
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-green-500 mt-0.5">+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card hover={false} className="p-6">
                <h3 className="text-sm font-medium text-red-400 mb-3">Areas for Improvement</h3>
                <ul className="space-y-2">
                  {(scorecard.weaknesses || []).map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-red-500 mt-0.5">-</span>
                      {w}
                    </li>
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
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-4 pb-8">
          <Link href={`/interview/${data.problem_id}?level=${data.career_level}`}>
            <Button variant="primary" size="lg">
              Try Again
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="secondary" size="lg">
              Back to History
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
