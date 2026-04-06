export interface LessonSegment {
  id: string;
  text: string;
  avatar_emotion: string;
  avatar_gesture: string;
  diagram_state: string;
  diagram_animations: string[];
  pause_for_thought: boolean;
  thought_prompt: string | null;
  duration_ms: number;
}

export interface LessonData {
  topic_id: string;
  lesson_id: string;
  title: string;
  description: string;
  segments: LessonSegment[];
}

export interface WordTiming {
  word: string;
  start_ms: number;
  end_ms: number;
}

export interface TTSResponse {
  audio_url: string;
  duration_ms: number;
  word_timings: WordTiming[];
}

export interface DiagramStateConfig {
  diagram: string;
  initial_state: string;
  states: Record<string, DiagramState>;
}

export interface DiagramState {
  elements_visible: string[];
  description: string;
  enter_animation?: {
    type: string;
    duration_ms: number;
    stagger_ms?: number;
    effects?: string[];
  };
  packets?: {
    id: string;
    label: string;
    target: string;
    formula: string;
  }[];
  remaps?: {
    id: string;
    from: string;
    to: string;
    old_formula: string;
    new_formula: string;
    stayed?: boolean;
  }[];
  crash_target?: string;
  annotation?: string;
  data_placement?: Record<string, string[]>;
}

export type AvatarEmotion =
  | "idle_neutral"
  | "teach_explain"
  | "teach_point"
  | "emotion_excited"
  | "emotion_concerned"
  | "emotion_serious"
  | "interact_question";

export type PlaybackSpeed = 0.75 | 1 | 1.25 | 1.5;
