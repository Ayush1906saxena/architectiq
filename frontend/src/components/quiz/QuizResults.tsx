"use client";

import { motion } from "framer-motion";
import { QuizQuestion } from "@/types/quiz";
import Button from "@/components/ui/Button";
import Link from "next/link";

interface QuizResultsProps {
  answers: { questionId: string; selected: number; correct: boolean }[];
  questions: QuizQuestion[];
  topicId: string;
}

function getBadge(accuracy: number): { label: string; color: string } | null {
  if (accuracy >= 0.95) return { label: "Diamond", color: "text-cyan-300" };
  if (accuracy >= 0.85) return { label: "Gold", color: "text-yellow-400" };
  if (accuracy >= 0.7) return { label: "Silver", color: "text-gray-300" };
  if (accuracy >= 0.5) return { label: "Bronze", color: "text-amber-600" };
  return null;
}

function CircularProgress({ percentage }: { percentage: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width="140" height="140" className="transform -rotate-90">
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="#1f2937"
        strokeWidth="10"
      />
      <motion.circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke={percentage >= 70 ? "#22c55e" : percentage >= 50 ? "#eab308" : "#ef4444"}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <text
        x="70"
        y="70"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-gray-100 text-2xl font-bold"
        transform="rotate(90, 70, 70)"
      >
        {percentage}%
      </text>
    </svg>
  );
}

export default function QuizResults({
  answers,
  questions,
  topicId,
}: QuizResultsProps) {
  const correctCount = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const accuracy = total > 0 ? correctCount / total : 0;
  const percentage = Math.round(accuracy * 100);
  const badge = getBadge(accuracy);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="rounded-2xl border border-gray-700 bg-gray-900/80 backdrop-blur-sm p-8">
        <h2 className="text-2xl font-bold text-gray-100 text-center mb-8">
          Quiz Complete
        </h2>

        <div className="flex flex-col items-center gap-6 mb-8">
          <CircularProgress percentage={percentage} />

          <div className="text-center">
            <p className="text-4xl font-bold text-gray-100">
              {correctCount}
              <span className="text-lg text-gray-400 font-normal">
                /{total}
              </span>
            </p>
            <p className="text-sm text-gray-400 mt-1">correct answers</p>
          </div>

          {badge && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
              className="text-center"
            >
              <p className="text-sm text-gray-400 mb-1">Mastery Badge</p>
              <p className={`text-2xl font-bold ${badge.color}`}>
                {badge.label}
              </p>
            </motion.div>
          )}
        </div>

        <div className="border-t border-gray-700 pt-6 mb-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Question Review
          </h3>
          <div className="flex flex-col gap-2">
            {questions.map((q, i) => {
              const answer = answers[i];
              return (
                <div
                  key={q.id}
                  className="flex items-start gap-3 text-sm py-2"
                >
                  <span
                    className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      answer?.correct
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {answer?.correct ? "\u2713" : "\u2717"}
                  </span>
                  <span className="text-gray-300 leading-snug">
                    {q.question}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
          <Link href="/" className="flex-1">
            <Button variant="secondary" size="lg" className="w-full">
              Back to Lessons
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
