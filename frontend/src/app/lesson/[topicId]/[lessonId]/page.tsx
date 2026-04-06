"use client";

import LessonPlayer from "@/components/lesson/LessonPlayer";

interface LessonPageProps {
  params: {
    topicId: string;
    lessonId: string;
  };
}

export default function LessonPage({ params }: LessonPageProps) {
  return <LessonPlayer topicId={params.topicId} lessonId={params.lessonId} />;
}
