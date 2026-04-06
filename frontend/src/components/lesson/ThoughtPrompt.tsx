"use client";

import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";

interface ThoughtPromptProps {
  show: boolean;
  prompt: string | null;
  onContinue: () => void;
}

export default function ThoughtPrompt({
  show,
  prompt,
  onContinue,
}: ThoughtPromptProps) {
  return (
    <AnimatePresence>
      {show && prompt && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10"
        >
          <div className="bg-gray-800 border border-amber-500/50 rounded-xl p-6 max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 text-sm font-medium font-mono">
                Pause &amp; Think
              </span>
            </div>
            <p className="text-gray-200 text-lg leading-relaxed mb-5">
              {prompt}
            </p>
            <div className="flex justify-end">
              <Button variant="primary" onClick={onContinue}>
                I&apos;ve thought about it — Continue
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
