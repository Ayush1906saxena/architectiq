"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fetchDailyChallenge, fetchStreak } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import PageTransition from "@/components/ui/PageTransition";

interface DailyChallenge {
  problem_id: string;
  career_level: string;
  challenge_date: string;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_challenge_date: string | null;
  completed_today: boolean;
}

export default function DailyPage() {
  const { user } = useAuthStore();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([fetchDailyChallenge(), fetchStreak()])
      .then(([c, s]) => {
        setChallenge(c);
        setStreak(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <PageTransition>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-orange-400">
                <path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Daily Challenge</h2>
            <p className="text-gray-400 mb-6">Sign in to access your daily challenge and build a streak.</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen px-8 pt-12 pb-12">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
            Daily Challenge
          </h1>
          <p className="text-gray-400">
            A new system design problem every day. Build your streak and stay sharp.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-8">
            <motion.div
              className="w-4 h-4 border-2 border-gray-600 border-t-orange-500 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            Loading today&apos;s challenge...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Challenge Hero Card */}
            <motion.div
              className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-900 to-orange-950/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              {/* Gradient accent line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500" />

              <div className="p-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded">
                    Today&apos;s Challenge
                  </span>
                  {challenge && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 bg-gray-800 px-2 py-1 rounded">
                      {challenge.challenge_date}
                    </span>
                  )}
                </div>

                {challenge ? (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {challenge.problem_id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </h2>
                    <div className="flex items-center gap-3 mb-6">
                      <span className="text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full">
                        Level: <span className="text-blue-400 font-medium">{challenge.career_level}</span>
                      </span>
                    </div>

                    {streak?.completed_today ? (
                      <motion.div
                        className="flex items-center gap-3 px-5 py-3 bg-green-500/10 border border-green-500/30 rounded-xl"
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <div>
                          <p className="text-green-400 font-semibold text-sm">Completed!</p>
                          <p className="text-green-400/60 text-xs">You&apos;ve finished today&apos;s challenge. Come back tomorrow!</p>
                        </div>
                      </motion.div>
                    ) : (
                      <Link
                        href={`/interview/${challenge.problem_id}?level=${challenge.career_level}&daily=true`}
                      >
                        <motion.button
                          className="px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-orange-500/20 transition-all"
                          whileHover={{ scale: 1.02, y: -1 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Start Today&apos;s Challenge
                        </motion.button>
                      </Link>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">No challenge available right now. Check back soon!</p>
                )}
              </div>
            </motion.div>

            {/* Streak Panel */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {/* Current Streak */}
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                  Current Streak
                </div>
                <div className="flex items-center gap-3">
                  {(streak?.current_streak ?? 0) > 0 ? (
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-orange-400" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      </svg>
                    </motion.div>
                  ) : (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                  )}
                  <div>
                    <span className="text-3xl font-bold text-white">{streak?.current_streak ?? 0}</span>
                    <span className="text-sm text-gray-500 ml-1.5">day{(streak?.current_streak ?? 0) !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>

              {/* Longest Streak */}
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                  Longest Streak
                </div>
                <div className="flex items-center gap-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-yellow-500" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <div>
                    <span className="text-2xl font-bold text-white">{streak?.longest_streak ?? 0}</span>
                    <span className="text-sm text-gray-500 ml-1.5">day{(streak?.longest_streak ?? 0) !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                  Today&apos;s Status
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${streak?.completed_today ? "bg-green-400" : "bg-gray-600"}`} />
                  <span className={`text-sm font-medium ${streak?.completed_today ? "text-green-400" : "text-gray-400"}`}>
                    {streak?.completed_today ? "Completed" : "Not yet completed"}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
