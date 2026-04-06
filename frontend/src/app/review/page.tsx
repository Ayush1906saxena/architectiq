"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchReviewQueue } from "@/lib/api";
import { TopicMastery } from "@/types/progress";
import MasteryBadge from "@/components/curriculum/MasteryBadge";
import Button from "@/components/ui/Button";

export default function ReviewPage() {
  const [queue, setQueue] = useState<TopicMastery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchReviewQueue();
        setQueue(data);
      } catch {
        // Review queue may be empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Spaced Review</h1>
        <p className="text-gray-400">
          Topics due for review based on the SM-2 spaced repetition algorithm.
          Reviewing at the right time strengthens long-term retention.
        </p>
      </div>

      {loading && <div className="text-gray-500 py-8">Loading review queue...</div>}

      {!loading && queue.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h2 className="text-xl font-semibold text-gray-200 mb-2">All caught up!</h2>
          <p className="text-gray-400 mb-4">
            No topics are due for review right now. Complete some quizzes to build your review schedule.
          </p>
          <Link href="/curriculum">
            <Button>Browse Curriculum</Button>
          </Link>
        </div>
      )}

      {queue.length > 0 && (
        <div className="space-y-3">
          {queue.map((topic) => (
            <div
              key={topic.topic_id}
              className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-gray-200">
                    {topic.topic_id.replace(/-/g, " ")}
                  </h3>
                  <MasteryBadge badge={topic.badge} size="sm" />
                </div>
                <p className="text-xs text-gray-500 font-mono">
                  {topic.questions_correct}/{topic.questions_attempted} correct
                  {topic.next_review_at && ` · Due: ${new Date(topic.next_review_at).toLocaleDateString()}`}
                </p>
              </div>
              <Link href={`/quiz/${topic.topic_id}`}>
                <Button size="sm">Review Quiz</Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
