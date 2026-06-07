"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchInterviewHistory, fetchInterviewStats } from "@/lib/api";
import { motion } from "framer-motion";
import Link from "next/link";

interface Interview {
  id: number;
  problem_id: string;
  problem_title: string;
  career_level: string;
  score: number | null;
  badge: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  passed: number;
  avg_score: number;
  best_score: number;
}

function badgeColor(badge: string | null): string {
  switch (badge) {
    case "gold":
      return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
    case "silver":
      return "text-gray-300 bg-gray-300/10 border-gray-300/20";
    case "bronze":
      return "text-orange-400 bg-orange-400/10 border-orange-400/20";
    case "pass":
      return "text-green-400 bg-green-400/10 border-green-400/20";
    default:
      return "text-gray-500 bg-gray-500/10 border-gray-500/20";
  }
}

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
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
        const [historyData, statsData] = await Promise.all([
          fetchInterviewHistory<Interview[]>(),
          fetchInterviewStats<Stats>(),
        ]);
        setInterviews(historyData);
        setStats(statsData);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-200 mb-2">Sign in to view history</h2>
          <p className="text-gray-400 mb-6 text-sm">Your interview history and stats will appear here once you sign in.</p>
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

  return (
    <div className="min-h-screen bg-gray-950 p-6 md:p-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-5xl mx-auto"
      >
        <h1 className="text-2xl font-bold text-white mb-6">Interview History</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Interviews", value: stats.total },
              { label: "Passed", value: stats.passed },
              { label: "Avg Score", value: stats.avg_score ? `${Math.round(stats.avg_score)}%` : "--" },
              { label: "Best Score", value: stats.best_score ? `${stats.best_score}%` : "--" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4"
              >
                <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Interviews list */}
        {interviews.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400">No interviews yet. Start your first one!</p>
            <Link
              href="/interview"
              className="inline-block mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Start Interview
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {interviews.map((interview, i) => (
              <Link key={interview.id} href={`/history/${interview.id}`}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-200 truncate">
                      {interview.problem_title || interview.problem_id}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500 capitalize">
                        {interview.career_level}
                      </span>
                      <span className="text-xs text-gray-600">
                        {new Date(interview.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {interview.score !== null && (
                      <span className="text-sm font-semibold text-gray-200">
                        {interview.score}%
                      </span>
                    )}
                    {interview.badge && (
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${badgeColor(interview.badge)}`}
                      >
                        {interview.badge}
                      </span>
                    )}
                    <svg
                      className="w-4 h-4 text-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
