import { create } from "zustand";
import { LessonData, PlaybackSpeed } from "@/types/lesson";

interface AppState {
  // Lesson state
  currentLesson: LessonData | null;
  currentSegmentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  playbackSpeed: PlaybackSpeed;

  // Avatar state
  avatarState: string;

  // Diagram state
  diagramState: string;

  // Pause for thought
  showThoughtPrompt: boolean;
  thoughtPromptText: string | null;

  // Actions
  setLesson: (lesson: LessonData) => void;
  setSegmentIndex: (index: number) => void;
  setPlaying: (playing: boolean) => void;
  setLoading: (loading: boolean) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setAvatarState: (state: string) => void;
  setDiagramState: (state: string) => void;
  showThought: (prompt: string) => void;
  dismissThought: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentLesson: null,
  currentSegmentIndex: 0,
  isPlaying: false,
  isLoading: false,
  playbackSpeed: 1,
  avatarState: "idle_neutral",
  diagramState: "empty",
  showThoughtPrompt: false,
  thoughtPromptText: null,

  setLesson: (lesson) => set({ currentLesson: lesson, currentSegmentIndex: 0 }),
  setSegmentIndex: (index) => set({ currentSegmentIndex: index }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setLoading: (loading) => set({ isLoading: loading }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setAvatarState: (state) => set({ avatarState: state }),
  setDiagramState: (state) => set({ diagramState: state }),
  showThought: (prompt) =>
    set({ showThoughtPrompt: true, thoughtPromptText: prompt, isPlaying: false }),
  dismissThought: () =>
    set({ showThoughtPrompt: false, thoughtPromptText: null }),
  reset: () =>
    set({
      currentLesson: null,
      currentSegmentIndex: 0,
      isPlaying: false,
      isLoading: false,
      avatarState: "idle_neutral",
      diagramState: "empty",
      showThoughtPrompt: false,
      thoughtPromptText: null,
    }),
}));
