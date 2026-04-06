"use client";

import Link from "next/link";
import QuizEngine from "@/components/quiz/QuizEngine";
import Button from "@/components/ui/Button";

interface QuizPageProps {
  params: {
    topicId: string;
  };
}

export default function QuizPage({ params }: QuizPageProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              &larr; Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-100">
            Quiz: {params.topicId.replace(/-/g, " ")}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <QuizEngine topicId={params.topicId} />
      </main>
    </div>
  );
}
