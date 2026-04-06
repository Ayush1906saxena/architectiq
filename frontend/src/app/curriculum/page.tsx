"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { fetchCurriculum } from "@/lib/api";
import { useProgressStore } from "@/store/useProgressStore";
import SkillTree from "@/components/curriculum/SkillTree";
import PageTransition from "@/components/ui/PageTransition";

export default function CurriculumPage() {
  const { curriculum, isLoading, setCurriculum, setLoading } = useProgressStore();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchCurriculum();
        setCurriculum(data);
      } catch (err) {
        console.error("Failed to load curriculum:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setCurriculum, setLoading]);

  return (
    <PageTransition>
      <div className="min-h-screen p-8 max-w-5xl mx-auto">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-white mb-2">Curriculum</h1>
          <p className="text-gray-400">
            Your learning path from fundamentals to expert-level system design.
          </p>
        </motion.div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <motion.div
              className="w-6 h-6 border-2 border-gray-700 border-t-blue-500 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            <span className="ml-3 text-gray-500 text-sm">Loading curriculum...</span>
          </div>
        )}

        {curriculum && <SkillTree curriculum={curriculum} />}

        {!isLoading && !curriculum && (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-gray-500 mb-2">Could not load curriculum.</p>
            <p className="text-gray-600 text-sm">Make sure the backend is running on port 8000.</p>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
