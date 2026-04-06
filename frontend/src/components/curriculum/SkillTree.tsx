"use client";

import { motion } from "framer-motion";
import { Curriculum } from "@/types/progress";
import TopicNode from "./TopicNode";

interface SkillTreeProps {
  curriculum: Curriculum;
}

const TIER_COLORS: Record<string, string> = {
  "tier-0": "border-l-emerald-600",
  "tier-1": "border-l-blue-600",
  "tier-2": "border-l-purple-600",
  "tier-3": "border-l-amber-600",
  "tier-4": "border-l-red-600",
  "tier-5": "border-l-pink-600",
  "tier-6": "border-l-cyan-600",
};

const TIER_DESCRIPTIONS: Record<string, string> = {
  "tier-0": "For the absolute beginner — from 'what is a computer' to networking.",
  "tier-1": "Single-server mastery — web servers, storage, caching, concurrency.",
  "tier-2": "Distributed systems fundamentals — the building blocks.",
  "tier-3": "Core patterns — API gateways, message queues, microservices.",
  "tier-4": "Real-world system design (HLD) — design Twitter, Uber, etc.",
  "tier-5": "Low-level design (LLD) — object-oriented design problems.",
  "tier-6": "Expert mastery — database internals, ML systems, advanced infra.",
};

const tierStagger = {
  hidden: { opacity: 0 } as const,
  show: { opacity: 1, transition: { staggerChildren: 0.12 } } as const,
};

const tierFade = {
  hidden: { opacity: 0, x: -20 } as const,
  show: { opacity: 1, x: 0, transition: { duration: 0.5 } } as const,
};

const moduleStagger = {
  hidden: { opacity: 0 } as const,
  show: { opacity: 1, transition: { staggerChildren: 0.06 } } as const,
};

const moduleFade = {
  hidden: { opacity: 0, y: 12 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } } as const,
};

export default function SkillTree({ curriculum }: SkillTreeProps) {
  return (
    <motion.div
      className="space-y-8"
      variants={tierStagger}
      initial="hidden"
      animate="show"
    >
      {curriculum.tiers.map((tier) => (
        <motion.section
          key={tier.id}
          variants={tierFade}
          className={`border-l-2 pl-6 ${TIER_COLORS[tier.id] || "border-l-gray-700"}`}
        >
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-gray-200">{tier.title}</h2>
              <span className="text-[10px] font-mono text-gray-500 uppercase bg-gray-800 px-2 py-0.5 rounded">
                {tier.id}
              </span>
              <span className="text-[10px] font-mono text-gray-600">
                {tier.modules.length} module{tier.modules.length !== 1 ? "s" : ""} · {tier.modules.reduce((sum, m) => sum + m.lessons.length, 0)} lessons
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {TIER_DESCRIPTIONS[tier.id] || ""}
            </p>
          </div>

          <motion.div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            variants={moduleStagger}
            initial="hidden"
            animate="show"
          >
            {tier.modules.map((mod) => {
              const completedLessons = mod.lessons.filter((l) => l.completed).length;
              return (
                <motion.div key={mod.slug} variants={moduleFade}>
                  <TopicNode
                    slug={mod.slug}
                    title={mod.title}
                    tier={tier.id}
                    masteryLevel={mod.mastery?.level || 0}
                    badge={mod.mastery?.badge || "none"}
                    lessonsCompleted={completedLessons}
                    totalLessons={mod.lessons.length}
                    firstLessonId={mod.lessons[0]?.id || "L1-intro"}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        </motion.section>
      ))}
    </motion.div>
  );
}
