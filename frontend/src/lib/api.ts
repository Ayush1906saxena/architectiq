import { LessonData, TTSResponse } from "@/types/lesson";
import { QuizBank, QuizSubmission, QuizResult, QuizQuestion } from "@/types/quiz";
import { ProgressSummary, TopicMastery, Curriculum } from "@/types/progress";
import { DesignChallengeRequest, DesignChallengeResponse, AskRequest, AskResponse } from "@/types/challenge";
import {
  InterviewProblem,
  StartInterviewResponse,
  InterviewMessageResponse,
  Scorecard,
} from "@/types/interview";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Registered by the auth store so a 401 anywhere logs the user out + redirects,
// instead of surfacing as a generic "failed to fetch". Avoids an import cycle.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

interface ApiOptions extends RequestInit {
  /** Don't trigger the global 401 handler (used by the auth endpoints themselves). */
  skipAuthRedirect?: boolean;
}

/**
 * Single entry point for all API calls. Always sends the auth cookie
 * (credentials: "include"), sets JSON headers, parses the body, and centralizes
 * error + 401 handling.
 */
async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { skipAuthRedirect, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    ...rest,
  });

  if (res.status === 401 && !skipAuthRedirect) {
    onUnauthorized?.();
    throw new ApiError("Session expired. Please sign in again.", 401);
  }

  if (!res.ok) {
    let detail: string | undefined;
    try {
      detail = (await res.json())?.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- Lessons ---

export function fetchLesson(topicId: string, lessonId: string): Promise<LessonData> {
  return apiFetch(`/api/lessons/${topicId}/${lessonId}`);
}

export function fetchModuleLessons(
  topicId: string
): Promise<{ topic_id: string; lessons: { id: string; title: string; path: string }[] }> {
  return apiFetch(`/api/lessons/${topicId}/module-lessons`);
}

export function fetchDiagramStates(topicId: string, lessonId: string): Promise<Record<string, unknown>> {
  return apiFetch(`/api/lessons/${topicId}/${lessonId}/diagram-states`);
}

// --- TTS ---

export function generateTTS(text: string, segmentId: string, topicId: string, lessonId: string): Promise<TTSResponse> {
  return apiFetch(`/api/tts`, {
    method: "POST",
    body: JSON.stringify({ text, segment_id: segmentId, topic_id: topicId, lesson_id: lessonId }),
  });
}

export function getAudioUrl(path: string): string {
  return `${API_BASE}${path}`;
}

// --- Quiz ---

export function fetchQuiz(topicId: string): Promise<QuizBank> {
  return apiFetch(`/api/quiz/${topicId}`);
}

export function submitQuizAnswer(submission: QuizSubmission): Promise<QuizResult> {
  return apiFetch(`/api/quiz/submit`, { method: "POST", body: JSON.stringify(submission) });
}

export function fetchAdaptiveQuestion(topicId: string, difficulty: number, context?: string): Promise<QuizQuestion> {
  return apiFetch(`/api/quiz/adaptive`, {
    method: "POST",
    body: JSON.stringify({ topic_id: topicId, current_difficulty: difficulty, previous_question: context || "" }),
  });
}

// --- Progress ---

export function fetchProgress(): Promise<ProgressSummary> {
  return apiFetch(`/api/progress`);
}

export function fetchTopicMastery(topicId: string): Promise<TopicMastery> {
  return apiFetch(`/api/progress/${topicId}`);
}

export function fetchReviewQueue(): Promise<TopicMastery[]> {
  return apiFetch(`/api/review-queue`);
}

// --- Curriculum ---

export function fetchCurriculum(): Promise<Curriculum> {
  return apiFetch(`/api/curriculum`);
}

// --- Design Challenge ---

export function sendDesignChallengeMessage(request: DesignChallengeRequest): Promise<DesignChallengeResponse> {
  return apiFetch(`/api/design-challenge`, { method: "POST", body: JSON.stringify(request) });
}

// --- Ask Prof. Arch ---

export function askProfArch(request: AskRequest): Promise<AskResponse> {
  return apiFetch(`/api/ask`, { method: "POST", body: JSON.stringify(request) });
}

// --- Recommendations ---

export function fetchRecommendations<T = unknown>(): Promise<T> {
  return apiFetch(`/api/recommendations`);
}

// --- Interview ---

export function fetchInterviewProblems(): Promise<InterviewProblem[]> {
  return apiFetch(`/api/interview/problems`);
}

export function startInterview(problemId: string, careerLevel: string): Promise<StartInterviewResponse> {
  return apiFetch(`/api/interview/start`, {
    method: "POST",
    body: JSON.stringify({ problem_id: problemId, career_level: careerLevel }),
  });
}

export function sendInterviewMessage(sessionId: string, message: string): Promise<InterviewMessageResponse> {
  return apiFetch(`/api/interview/message`, {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

export function endInterview(sessionId: string): Promise<{ is_complete: boolean; scorecard: Scorecard }> {
  return apiFetch(`/api/interview/${sessionId}/end`, { method: "POST" });
}

export function fetchScorecard(sessionId: string): Promise<Scorecard> {
  return apiFetch(`/api/interview/${sessionId}/scorecard`);
}

// --- Interview TTS ---

export function generateInterviewTTS(text: string): Promise<{ audio_url: string; duration_ms: number }> {
  return apiFetch(`/api/tts/interview`, { method: "POST", body: JSON.stringify({ text }) });
}

// --- Daily Challenge ---

export function fetchDailyChallenge<T = unknown>(): Promise<T> {
  return apiFetch(`/api/daily/challenge`);
}

export function fetchStreak<T = unknown>(): Promise<T> {
  return apiFetch(`/api/daily/streak`);
}

export function completeDailyChallenge<T = unknown>(sessionId: string): Promise<T> {
  return apiFetch(`/api/daily/complete`, { method: "POST", body: JSON.stringify({ session_id: sessionId }) });
}

// --- Leaderboard ---

export function fetchLeaderboard<T = unknown>(): Promise<T> {
  return apiFetch(`/api/leaderboard`);
}

export function fetchMyRank<T = unknown>(): Promise<T> {
  return apiFetch(`/api/leaderboard/me`);
}

// --- History ---

export function fetchInterviewHistory<T = unknown>(): Promise<T> {
  return apiFetch(`/api/history/interviews`);
}

export function fetchInterviewReplay<T = unknown>(historyId: number): Promise<T> {
  return apiFetch(`/api/history/interviews/${historyId}/replay`);
}

export function fetchInterviewStats<T = unknown>(): Promise<T> {
  return apiFetch(`/api/history/stats`);
}

export { API_BASE };
