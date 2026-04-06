export interface TopicMastery {
  topic_id: string;
  mastery_level: number;
  badge: string;
  questions_attempted: number;
  questions_correct: number;
  current_difficulty: number;
  next_review_at: string | null;
}

export interface LessonProgressItem {
  topic_id: string;
  lesson_id: string;
  completed: boolean;
  last_segment_index: number;
}

export interface ProgressSummary {
  topics: TopicMastery[];
  lessons: LessonProgressItem[];
  total_lessons_completed: number;
  total_quizzes_taken: number;
}

export interface CurriculumModule {
  id: string;
  slug: string;
  title: string;
  description?: string;
  path: string;
  mastery?: {
    level: number;
    badge: string;
    questions_attempted: number;
  };
  lessons: {
    id: string;
    title: string;
    path: string;
    completed?: boolean;
  }[];
}

export interface CurriculumTier {
  id: string;
  title: string;
  modules: CurriculumModule[];
}

export interface Curriculum {
  tiers: CurriculumTier[];
}
