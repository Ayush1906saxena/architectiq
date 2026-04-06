import { create } from "zustand";
import { TopicMastery, ProgressSummary, Curriculum } from "@/types/progress";

interface ProgressState {
  curriculum: Curriculum | null;
  progress: ProgressSummary | null;
  reviewQueue: TopicMastery[];
  isLoading: boolean;

  setCurriculum: (c: Curriculum) => void;
  setProgress: (p: ProgressSummary) => void;
  setReviewQueue: (q: TopicMastery[]) => void;
  setLoading: (l: boolean) => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  curriculum: null,
  progress: null,
  reviewQueue: [],
  isLoading: false,

  setCurriculum: (curriculum) => set({ curriculum }),
  setProgress: (progress) => set({ progress }),
  setReviewQueue: (reviewQueue) => set({ reviewQueue }),
  setLoading: (isLoading) => set({ isLoading }),
}));
