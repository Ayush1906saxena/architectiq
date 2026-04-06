import { create } from "zustand";
import { QuizQuestion, QuizResult } from "@/types/quiz";

interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  selectedAnswer: number | null;
  answers: { questionId: string; selected: number; correct: boolean }[];
  currentResult: QuizResult | null;
  showExplanation: boolean;
  isSubmitting: boolean;
  difficulty: number;
  isComplete: boolean;

  setQuestions: (questions: QuizQuestion[]) => void;
  selectAnswer: (index: number) => void;
  setResult: (result: QuizResult) => void;
  showExplanationPanel: () => void;
  nextQuestion: () => void;
  setSubmitting: (submitting: boolean) => void;
  setDifficulty: (d: number) => void;
  addAdaptiveQuestion: (q: QuizQuestion) => void;
  reset: () => void;
}

export const useQuizStore = create<QuizState>((set, get) => ({
  questions: [],
  currentIndex: 0,
  selectedAnswer: null,
  answers: [],
  currentResult: null,
  showExplanation: false,
  isSubmitting: false,
  difficulty: 1,
  isComplete: false,

  setQuestions: (questions) => set({ questions, currentIndex: 0, answers: [], isComplete: false }),
  selectAnswer: (index) => set({ selectedAnswer: index }),
  setResult: (result) =>
    set((state) => ({
      currentResult: result,
      answers: [
        ...state.answers,
        {
          questionId: state.questions[state.currentIndex]?.id || "",
          selected: state.selectedAnswer ?? -1,
          correct: result.is_correct,
        },
      ],
    })),
  showExplanationPanel: () => set({ showExplanation: true }),
  nextQuestion: () =>
    set((state) => {
      const nextIdx = state.currentIndex + 1;
      if (nextIdx >= state.questions.length) {
        return { isComplete: true, showExplanation: false, selectedAnswer: null, currentResult: null };
      }
      return {
        currentIndex: nextIdx,
        selectedAnswer: null,
        currentResult: null,
        showExplanation: false,
      };
    }),
  setSubmitting: (submitting) => set({ isSubmitting: submitting }),
  setDifficulty: (d) => set({ difficulty: Math.max(1, Math.min(10, d)) }),
  addAdaptiveQuestion: (q) =>
    set((state) => ({ questions: [...state.questions, q] })),
  reset: () =>
    set({
      questions: [],
      currentIndex: 0,
      selectedAnswer: null,
      answers: [],
      currentResult: null,
      showExplanation: false,
      isSubmitting: false,
      difficulty: 1,
      isComplete: false,
    }),
}));
