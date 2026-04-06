"use client";

import { motion } from "framer-motion";
import { QuizQuestion, QuizResult } from "@/types/quiz";

interface MCQCardProps {
  question: QuizQuestion;
  selectedAnswer: number | null;
  result: QuizResult | null;
  onSelect: (index: number) => void;
}

const labels = ["A", "B", "C", "D"];

function getOptionStyle(
  index: number,
  selectedAnswer: number | null,
  result: QuizResult | null
): string {
  const base =
    "w-full text-left px-5 py-4 rounded-xl border-2 transition-colors font-medium flex items-center gap-4";

  if (result) {
    if (index === result.correct_answer) {
      return `${base} border-green-500 bg-green-500/15 text-green-300`;
    }
    if (index === selectedAnswer && !result.is_correct) {
      return `${base} border-red-500 bg-red-500/15 text-red-300`;
    }
    return `${base} border-gray-700 bg-gray-800/40 text-gray-500 opacity-60`;
  }

  if (index === selectedAnswer) {
    return `${base} border-blue-500 bg-blue-500/15 text-blue-200`;
  }

  return `${base} border-gray-700 bg-gray-800/60 text-gray-200 hover:border-blue-500/50 hover:bg-gray-800 cursor-pointer`;
}

export default function MCQCard({
  question,
  selectedAnswer,
  result,
  onSelect,
}: MCQCardProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="text-xl md:text-2xl font-semibold text-gray-100 mb-8 leading-relaxed">
        {question.question}
      </h2>

      <div className="flex flex-col gap-3">
        {question.options.map((option, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
            className={getOptionStyle(index, selectedAnswer, result)}
            onClick={() => !result && onSelect(index)}
            disabled={result !== null}
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-700/80 flex items-center justify-center text-sm font-bold">
              {labels[index]}
            </span>
            <span>{option}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
