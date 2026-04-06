export interface QuizQuestion {
  id: string;
  topic_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  wrong_explanations?: Record<string, string>;
  difficulty: number;
  tags: string[];
}

export interface QuizBank {
  topic_id: string;
  questions: QuizQuestion[];
}

export interface QuizSubmission {
  topic_id: string;
  question_id: string;
  selected_answer: number;
  time_taken_ms: number;
}

export interface MasteryUpdate {
  new_mastery: number;
  new_badge: string | null;
  difficulty_change: number;
}

export interface QuizResult {
  is_correct: boolean;
  correct_answer: number;
  explanation: string;
  mastery_update: MasteryUpdate;
}
