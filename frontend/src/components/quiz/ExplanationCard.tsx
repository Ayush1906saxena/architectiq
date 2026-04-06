"use client";

import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";

interface ExplanationCardProps {
  show: boolean;
  isCorrect: boolean;
  explanation: string;
  onContinue: () => void;
}

export default function ExplanationCard({
  show,
  isCorrect,
  explanation,
  onContinue,
}: ExplanationCardProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-2xl mx-auto mt-6"
        >
          <div className="rounded-xl border border-gray-700 bg-gray-900/80 backdrop-blur-sm p-6">
            <h3
              className={`text-lg font-bold mb-3 ${
                isCorrect ? "text-green-400" : "text-red-400"
              }`}
            >
              {isCorrect ? "Correct!" : "Incorrect"}
            </h3>
            <p className="text-gray-300 leading-relaxed mb-5">{explanation}</p>
            <Button variant="primary" size="md" onClick={onContinue}>
              Continue
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
