"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fetchCurriculum } from "@/lib/api";
import { useProgressStore } from "@/store/useProgressStore";
import MasteryBadge from "@/components/curriculum/MasteryBadge";
import PageTransition from "@/components/ui/PageTransition";
import Card from "@/components/ui/Card";

const stagger = {
  hidden: { opacity: 0 } as const,
  show: { opacity: 1, transition: { staggerChildren: 0.06 } } as const,
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 } as const,
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } } as const,
};

export default function Home() {
  const { curriculum, setCurriculum } = useProgressStore();

  useEffect(() => {
    fetchCurriculum().then(setCurriculum).catch(() => {});
  }, [setCurriculum]);

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col">
        {/* Hero */}
        <motion.div
          className="px-8 pt-12 pb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            Welcome to Architect<span className="text-blue-500">IQ</span>
          </h1>
          <p className="text-gray-400 max-w-2xl">
            Master system design from fundamentals to Staff-level interviews. AI-powered
            lessons with Prof. Arch, interactive diagrams, adaptive quizzes, and failure
            lab simulations.
          </p>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="px-8 pb-6"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { href: "/curriculum", icon: "\uD83D\uDCDA", label: "Curriculum", border: "hover:border-blue-500/40" },
              { href: "/ask", icon: "\uD83E\uDDD1\u200D\uD83C\uDFEB", label: "Ask Prof. Arch", border: "hover:border-purple-500/40" },
              { href: "/design-challenge/url-shortener", icon: "\uD83C\uDFAF", label: "Design Challenge", border: "hover:border-amber-500/40" },
              { href: "/failure-lab/network-partition", icon: "\uD83D\uDCA5", label: "Failure Lab", border: "hover:border-red-500/40" },
              { href: "/interview", icon: "\uD83C\uDFA4", label: "AI Interview", border: "hover:border-cyan-500/40" },
            ].map((item) => (
              <motion.div key={item.href} variants={fadeUp}>
                <Link
                  href={item.href}
                  className={`block bg-gray-900 border border-gray-800 ${item.border} rounded-xl p-4 text-center transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200`}
                >
                  <div className="text-2xl mb-1.5">{item.icon}</div>
                  <span className="text-xs text-gray-400">{item.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Lessons by Tier */}
        <div className="px-8 pb-12 flex-1">
          <motion.h2
            className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Available Lessons
          </motion.h2>

          {curriculum ? (
            <motion.div
              className="space-y-8"
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              {curriculum.tiers.map((tier) => (
                <motion.div key={tier.id} variants={fadeUp}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-gray-300">{tier.title}</h3>
                    <span className="text-[10px] font-mono text-gray-600 uppercase">{tier.id}</span>
                    <span className="text-[10px] font-mono text-gray-700">
                      {tier.modules.length} module{tier.modules.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <motion.div
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    variants={stagger}
                    initial="hidden"
                    animate="show"
                  >
                    {tier.modules.map((mod, mi) => (
                      <motion.div key={mod.slug} variants={fadeUp}>
                        <Card delay={mi * 0.04} className="p-4">
                          <Link href={`/lesson/${mod.slug}/${mod.lessons[0]?.id || "L1-intro"}`}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded">
                                {tier.id}
                              </span>
                              <MasteryBadge badge={mod.mastery?.badge || "none"} size="sm" />
                            </div>
                            <h4 className="text-sm font-medium text-gray-200 transition-colors">
                              {mod.title}
                            </h4>
                            {mod.description && (
                              <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                                {mod.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600 font-mono">
                              <span>{mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}</span>
                              <span>Quiz</span>
                            </div>
                          </Link>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              className="text-gray-500 text-sm py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Loading curriculum...
              </div>
            </motion.div>
          )}

          {/* Design Challenges */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 mt-10">
              Design Challenges
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { id: "url-shortener", title: "URL Shortener", desc: "Design bit.ly" },
                { id: "twitter-feed", title: "Social Media Feed", desc: "Design Twitter's timeline" },
                { id: "chat-system", title: "Chat System", desc: "Design WhatsApp" },
              ].map((c, i) => (
                <Card key={c.id} delay={0.55 + i * 0.08} className="p-4 hover:border-amber-500/40">
                  <Link href={`/design-challenge/${c.id}`}>
                    <h4 className="text-sm font-medium text-gray-200">{c.title}</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">{c.desc}</p>
                  </Link>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* Failure Labs */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 mt-10">
              Failure Lab
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { id: "network-partition", title: "Network Partition Simulator", desc: "Watch CP vs AP behavior during partitions" },
                { id: "cache-stampede", title: "Cache Stampede Simulator", desc: "See what happens when TTL expires under load" },
              ].map((s, i) => (
                <Card key={s.id} delay={0.7 + i * 0.08} className="p-4 hover:border-red-500/40">
                  <Link href={`/failure-lab/${s.id}`}>
                    <h4 className="text-sm font-medium text-gray-200">{s.title}</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">{s.desc}</p>
                  </Link>
                </Card>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
