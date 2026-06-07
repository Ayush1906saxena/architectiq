"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { fetchInterviewProblems, fetchRecommendations } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import Button from "@/components/ui/Button";
import PageTransition from "@/components/ui/PageTransition";

interface WeakDimension {
  name: string;
  avg_score: number;
  recommendation: string;
}

interface RecommendedProblem {
  problem_id: string;
  reason: string;
}

interface Recommendations {
  weak_dimensions: WeakDimension[];
  suggested_level: string | null;
  recommended_problems: RecommendedProblem[];
}

const stagger = {
  hidden: { opacity: 0 } as const,
  show: { opacity: 1, transition: { staggerChildren: 0.06 } } as const,
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } } as const,
};

const CAREER_LEVELS = [
  { key: "sde2", label: "SDE 2", desc: "Can you design a working system?", duration: "30 min", color: "from-green-500/20 to-green-500/5" },
  { key: "senior", label: "Senior", desc: "Can you design with trade-offs and scale?", duration: "40 min", color: "from-blue-500/20 to-blue-500/5" },
  { key: "staff", label: "Staff", desc: "Can you drive architecture decisions?", duration: "45 min", color: "from-purple-500/20 to-purple-500/5" },
  { key: "principal", label: "Principal", desc: "Can you design across teams and orgs?", duration: "50 min", color: "from-amber-500/20 to-amber-500/5" },
  { key: "vp", label: "VP / Architect", desc: "Can you align tech with business strategy?", duration: "55 min", color: "from-red-500/20 to-red-500/5" },
];

export default function InterviewSelectionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [problemCount, setProblemCount] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<string>("senior");
  const [isStarting, setIsStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);

  useEffect(() => {
    fetchInterviewProblems()
      .then((data) => setProblemCount(data.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchRecommendations<Recommendations>()
      .then((data) => {
        if (data) setRecommendations(data);
      })
      .catch(() => {});
  }, [user]);

  const handleStart = () => {
    setIsStarting(true);
    setCountdown(3);

    // Countdown 3...2...1...GO
    let count = 3;
    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(timer);
        setCountdown(null);
        // Navigate — the problem is randomly assigned on the interview page
        router.push(`/interview/random?level=${selectedLevel}`);
      }
    }, 800);
  };

  const currentLevelIndex = CAREER_LEVELS.findIndex((l) => l.key === selectedLevel);
  const currentLevel = CAREER_LEVELS[currentLevelIndex];

  return (
    <PageTransition>
      <div className="min-h-screen px-8 py-12 max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            System Design <span className="text-blue-500">Interview</span>
          </h1>
          <p className="text-gray-400 max-w-2xl">
            A real interview experience. You don&apos;t pick the problem — we assign one
            randomly, just like a real interview. The interviewer adapts to your level
            in real-time.
          </p>
        </motion.div>

        {/* How it works */}
        <motion.div
          className="mt-8 grid grid-cols-4 gap-4"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {[
            { step: "1", title: "Pick your level", desc: "Choose the role you're preparing for" },
            { step: "2", title: "Random problem", desc: "We assign a problem — no cherry-picking" },
            { step: "3", title: "Adaptive interview", desc: "Crushing it? We go harder. Struggling? We adjust." },
            { step: "4", title: "Detailed scorecard", desc: "8-dimension rubric with coaching" },
          ].map((item) => (
            <motion.div
              key={item.step}
              variants={fadeUp}
              className="bg-gray-900/50 border border-gray-800/50 rounded-lg p-3 text-center"
            >
              <div className="text-lg font-bold text-blue-500 mb-1">{item.step}</div>
              <div className="text-xs font-medium text-gray-300 mb-0.5">{item.title}</div>
              <div className="text-[10px] text-gray-500">{item.desc}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Recommendations Section */}
        {recommendations && (recommendations.recommended_problems.length > 0 || recommendations.suggested_level || recommendations.weak_dimensions.length > 0) && (
          <motion.div
            className="mt-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-4">
              Recommended for You
            </div>

            {/* Suggested Level Banner */}
            {recommendations.suggested_level && (
              <motion.div
                className="mb-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 border border-blue-500/30"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    &#8593;
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      You&apos;re ready for{" "}
                      <span className="text-blue-400 capitalize">{recommendations.suggested_level}</span>
                      {" "}&mdash; you&apos;ve been acing{" "}
                      <span className="text-purple-400 capitalize">{selectedLevel}</span>!
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Consider leveling up your next interview.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Weak Dimensions Chips */}
            {recommendations.weak_dimensions.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {recommendations.weak_dimensions.map((dim) => (
                  <span
                    key={dim.name}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-gray-800/80 border border-gray-700/50 text-gray-300"
                    title={dim.recommendation}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {dim.name.replace(/_/g, " ")}
                    <span className="text-gray-500">{dim.avg_score.toFixed(1)}/10</span>
                  </span>
                ))}
              </div>
            )}

            {/* Recommended Problem Cards */}
            {recommendations.recommended_problems.length > 0 && (
              <div className="space-y-2">
                {recommendations.recommended_problems.map((prob) => (
                  <motion.div
                    key={prob.problem_id}
                    className="p-4 rounded-xl bg-gray-900 border border-transparent bg-clip-padding relative"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgb(17 24 39), rgb(17 24 39)), linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3))",
                      backgroundOrigin: "border-box",
                      backgroundClip: "padding-box, border-box",
                      border: "1px solid transparent",
                    }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-200 capitalize">
                          {prob.problem_id.replace(/-/g, " ")}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                          {prob.reason}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Level Selector */}
        <motion.div
          className="mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-4">
            Select Your Level
          </div>

          <div className="space-y-2">
            {CAREER_LEVELS.map((level, i) => (
              <motion.button
                key={level.key}
                onClick={() => setSelectedLevel(level.key)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-4 ${
                  selectedLevel === level.key
                    ? "bg-gradient-to-r " + level.color + " border-blue-500/40 shadow-lg"
                    : "bg-gray-900 border-gray-800 hover:border-gray-700"
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                {/* Level number */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  selectedLevel === level.key
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-gray-800 text-gray-500"
                }`}>
                  L{i + 1}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${
                    selectedLevel === level.key ? "text-white" : "text-gray-300"
                  }`}>
                    {level.label}
                  </div>
                  <div className="text-[11px] text-gray-500">{level.desc}</div>
                </div>

                {/* Duration */}
                <div className="text-xs text-gray-500 font-mono">{level.duration}</div>

                {/* Selected indicator */}
                {selectedLevel === level.key && (
                  <motion.div
                    className="w-2 h-2 rounded-full bg-blue-500"
                    layoutId="levelIndicator"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Interview Info */}
        <motion.div
          className="mt-8 bg-gray-900/50 border border-gray-800 rounded-xl p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{problemCount}</div>
              <div className="text-[10px] text-gray-500 uppercase">Problems in Pool</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{currentLevel?.duration}</div>
              <div className="text-[10px] text-gray-500 uppercase">Interview Duration</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">8</div>
              <div className="text-[10px] text-gray-500 uppercase">Scoring Dimensions</div>
            </div>
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.div
          className="mt-8 flex justify-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <AnimatePresence mode="wait">
            {countdown !== null ? (
              <motion.div
                key="countdown"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="text-6xl font-bold text-blue-500"
              >
                {countdown}
              </motion.div>
            ) : (
              <motion.div key="button">
                <Button
                  size="lg"
                  disabled={isStarting}
                  onClick={handleStart}
                  className="px-12 py-4 text-base"
                >
                  {isStarting ? "Preparing..." : "Start Interview"}
                </Button>
                <p className="text-center text-[10px] text-gray-600 mt-2">
                  A random problem will be assigned. No going back.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </PageTransition>
  );
}
