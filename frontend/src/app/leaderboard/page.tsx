"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchLeaderboard, fetchMyRank } from "@/lib/api";
import { motion } from "framer-motion";

interface LeaderboardEntry {
  rank: number;
  username: string;
  display_name: string;
  avg_score: number;
  total_interviews: number;
  best_badge: string | null;
  current_streak: number;
}

const BADGE_STYLES: Record<string, string> = {
  bronze: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  silver: "text-gray-300 bg-gray-300/10 border-gray-300/20",
  gold: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  diamond: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  legendary: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

function BadgePill({ badge }: { badge: string | null }) {
  if (!badge) return <span className="text-gray-600 text-xs">--</span>;
  const style = BADGE_STYLES[badge.toLowerCase()] || "text-gray-400 bg-gray-400/10 border-gray-400/20";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${style}`}>
      {badge}
    </span>
  );
}

function StreakDisplay({ streak }: { streak: number }) {
  if (!streak) return <span className="text-gray-600 text-xs">0</span>;
  return (
    <span className="inline-flex items-center gap-1 text-orange-400 text-sm font-medium">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
        <path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      </svg>
      {streak}
    </span>
  );
}

const MEDAL_COLORS = [
  "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30",   // gold
  "from-gray-300/15 to-gray-400/5 border-gray-400/30",         // silver
  "from-amber-600/15 to-amber-700/5 border-amber-600/30",      // bronze
];

const MEDAL_ICONS = ["1st", "2nd", "3rd"];

function TopThreeCard({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className={`relative bg-gradient-to-b ${MEDAL_COLORS[index]} border rounded-2xl p-5 flex flex-col items-center text-center`}
    >
      {/* Rank badge */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-3 ${
          index === 0
            ? "bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500/30"
            : index === 1
            ? "bg-gray-300/15 text-gray-300 ring-2 ring-gray-400/30"
            : "bg-amber-600/15 text-amber-400 ring-2 ring-amber-600/30"
        }`}
      >
        {MEDAL_ICONS[index]}
      </div>

      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg font-bold mb-2">
        {(entry.display_name || entry.username)[0].toUpperCase()}
      </div>

      <h3 className="text-white font-semibold text-sm truncate max-w-full">
        {entry.display_name || entry.username}
      </h3>
      <p className="text-gray-500 text-xs mb-3">@{entry.username}</p>

      <div className="text-2xl font-bold text-white mb-1">
        {Math.round(entry.avg_score)}%
      </div>
      <p className="text-gray-400 text-xs mb-3">
        {entry.total_interviews} interview{entry.total_interviews !== 1 ? "s" : ""}
      </p>

      <div className="flex items-center gap-3">
        <BadgePill badge={entry.best_badge} />
        <StreakDisplay streak={entry.current_streak} />
      </div>
    </motion.div>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [lb, rank] = await Promise.all([
          fetchLeaderboard(),
          user ? fetchMyRank() : Promise.resolve(null),
        ]);
        setLeaderboard(lb);
        setMyRank(rank);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) {
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

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const userInList = user ? leaderboard.some((e) => e.username === user.username) : false;
  const showStickyRank = user && myRank && !userInList;

  return (
    <div className="min-h-screen bg-gray-950 p-6 md:p-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-5xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Leaderboard</h1>
          <p className="text-gray-400 text-sm">Top performers ranked by average interview score</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Empty state */}
        {leaderboard.length === 0 && !error ? (
          <div className="text-center py-20">
            <svg
              className="mx-auto h-14 w-14 text-gray-700 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-gray-300 mb-2">No rankings yet</h2>
            <p className="text-gray-500 text-sm">
              Complete an interview to appear on the leaderboard.
            </p>
          </div>
        ) : (
          <>
            {/* Top 3 podium */}
            {topThree.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {topThree.map((entry, i) => (
                  <TopThreeCard key={entry.username} entry={entry} index={i} />
                ))}
              </div>
            )}

            {/* Remaining table */}
            {rest.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wider border-b border-gray-800">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-3 sm:col-span-4">User</div>
                  <div className="col-span-2 text-right">Avg Score</div>
                  <div className="col-span-2 text-right hidden sm:block">Interviews</div>
                  <div className="col-span-2 text-center">Badge</div>
                  <div className="col-span-2 sm:col-span-1 text-right">Streak</div>
                </div>

                {/* Table rows */}
                {rest.map((entry, i) => {
                  const isCurrentUser = user && entry.username === user.username;
                  return (
                    <motion.div
                      key={entry.username}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.03, duration: 0.3 }}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm border-b border-gray-800/50 last:border-b-0 transition-colors ${
                        isCurrentUser
                          ? "bg-blue-500/5 border-l-2 border-l-blue-500"
                          : "hover:bg-gray-800/30"
                      }`}
                    >
                      <div className="col-span-1 text-gray-400 font-medium">
                        {entry.rank}
                      </div>
                      <div className="col-span-3 sm:col-span-4 flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {(entry.display_name || entry.username)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-gray-200 text-sm truncate font-medium">
                            {entry.display_name || entry.username}
                          </p>
                          <p className="text-gray-600 text-xs truncate hidden sm:block">
                            @{entry.username}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 text-right text-gray-200 font-semibold">
                        {Math.round(entry.avg_score)}%
                      </div>
                      <div className="col-span-2 text-right text-gray-400 hidden sm:block">
                        {entry.total_interviews}
                      </div>
                      <div className="col-span-2 text-center">
                        <BadgePill badge={entry.best_badge} />
                      </div>
                      <div className="col-span-2 sm:col-span-1 text-right">
                        <StreakDisplay streak={entry.current_streak} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Sticky "Your Position" card */}
      {showStickyRank && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-2xl z-30"
        >
          <div className="bg-gray-900 border border-blue-500/30 rounded-xl p-4 shadow-lg shadow-blue-500/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                #{myRank.rank}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Your Position</p>
                <p className="text-sm text-white font-semibold truncate">
                  {myRank.display_name || myRank.username}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <p className="text-lg font-bold text-white">{Math.round(myRank.avg_score)}%</p>
                <p className="text-xs text-gray-500">{myRank.total_interviews} interviews</p>
              </div>
              <BadgePill badge={myRank.best_badge} />
              <StreakDisplay streak={myRank.current_streak} />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
