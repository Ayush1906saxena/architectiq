import { LessonData, TTSResponse } from "@/types/lesson";
import { QuizBank, QuizSubmission, QuizResult, QuizQuestion } from "@/types/quiz";
import { ProgressSummary, TopicMastery, Curriculum } from "@/types/progress";
import { DesignChallengeRequest, DesignChallengeResponse, AskRequest, AskResponse } from "@/types/challenge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- Lessons ---

export async function fetchLesson(topicId: string, lessonId: string): Promise<LessonData> {
  const res = await fetch(`${API_BASE}/api/lessons/${topicId}/${lessonId}`);
  if (!res.ok) throw new Error(`Failed to fetch lesson: ${res.status}`);
  return res.json();
}

export async function fetchModuleLessons(topicId: string): Promise<{ topic_id: string; lessons: { id: string; title: string; path: string }[] }> {
  const res = await fetch(`${API_BASE}/api/lessons/${topicId}/module-lessons`);
  if (!res.ok) throw new Error(`Failed to fetch module lessons: ${res.status}`);
  return res.json();
}

export async function fetchDiagramStates(topicId: string, lessonId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/lessons/${topicId}/${lessonId}/diagram-states`);
  if (!res.ok) throw new Error(`Failed to fetch diagram states: ${res.status}`);
  return res.json();
}

// --- TTS ---

export async function generateTTS(text: string, segmentId: string, topicId: string, lessonId: string): Promise<TTSResponse> {
  const res = await fetch(`${API_BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, segment_id: segmentId, topic_id: topicId, lesson_id: lessonId }),
  });
  if (!res.ok) throw new Error(`TTS generation failed: ${res.status}`);
  return res.json();
}

export function getAudioUrl(path: string): string {
  return `${API_BASE}${path}`;
}

// --- Quiz ---

export async function fetchQuiz(topicId: string): Promise<QuizBank> {
  const res = await fetch(`${API_BASE}/api/quiz/${topicId}`);
  if (!res.ok) throw new Error(`Failed to fetch quiz: ${res.status}`);
  return res.json();
}

export async function submitQuizAnswer(submission: QuizSubmission): Promise<QuizResult> {
  const res = await fetch(`${API_BASE}/api/quiz/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) throw new Error(`Quiz submission failed: ${res.status}`);
  return res.json();
}

export async function fetchAdaptiveQuestion(topicId: string, difficulty: number, context?: string): Promise<QuizQuestion> {
  const res = await fetch(`${API_BASE}/api/quiz/adaptive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic_id: topicId, current_difficulty: difficulty, previous_question: context || "" }),
  });
  if (!res.ok) throw new Error(`Adaptive question failed: ${res.status}`);
  return res.json();
}

// --- Progress ---

export async function fetchProgress(): Promise<ProgressSummary> {
  const res = await fetch(`${API_BASE}/api/progress`);
  if (!res.ok) throw new Error(`Failed to fetch progress: ${res.status}`);
  return res.json();
}

export async function fetchTopicMastery(topicId: string): Promise<TopicMastery> {
  const res = await fetch(`${API_BASE}/api/progress/${topicId}`);
  if (!res.ok) throw new Error(`Failed to fetch mastery: ${res.status}`);
  return res.json();
}

export async function fetchReviewQueue(): Promise<TopicMastery[]> {
  const res = await fetch(`${API_BASE}/api/review-queue`);
  if (!res.ok) throw new Error(`Failed to fetch review queue: ${res.status}`);
  return res.json();
}

// --- Curriculum ---

export async function fetchCurriculum(): Promise<Curriculum> {
  const res = await fetch(`${API_BASE}/api/curriculum`);
  if (!res.ok) throw new Error(`Failed to fetch curriculum: ${res.status}`);
  return res.json();
}

// --- Design Challenge ---

export async function sendDesignChallengeMessage(request: DesignChallengeRequest): Promise<DesignChallengeResponse> {
  const res = await fetch(`${API_BASE}/api/design-challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Design challenge failed: ${res.status}`);
  return res.json();
}

// --- Ask Prof. Arch ---

export async function askProfArch(request: AskRequest): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Ask failed: ${res.status}`);
  return res.json();
}

// --- Interview ---

export async function fetchInterviewProblems() {
  const res = await fetch(`${API_BASE}/api/interview/problems`);
  if (!res.ok) throw new Error(`Failed to fetch interview problems: ${res.status}`);
  return res.json();
}

export async function startInterview(problemId: string, careerLevel: string) {
  const res = await fetch(`${API_BASE}/api/interview/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ problem_id: problemId, career_level: careerLevel }),
  });
  if (!res.ok) throw new Error(`Failed to start interview: ${res.status}`);
  return res.json();
}

export async function sendInterviewMessage(sessionId: string, message: string) {
  const res = await fetch(`${API_BASE}/api/interview/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) throw new Error(`Failed to send interview message: ${res.status}`);
  return res.json();
}

export async function endInterview(sessionId: string) {
  const res = await fetch(`${API_BASE}/api/interview/${sessionId}/end`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to end interview: ${res.status}`);
  return res.json();
}

export async function fetchScorecard(sessionId: string) {
  const res = await fetch(`${API_BASE}/api/interview/${sessionId}/scorecard`);
  if (!res.ok) throw new Error(`Failed to fetch scorecard: ${res.status}`);
  return res.json();
}

// --- Interview TTS ---

export async function generateInterviewTTS(text: string): Promise<{ audio_url: string; duration_ms: number }> {
  const res = await fetch(`${API_BASE}/api/tts/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Interview TTS failed: ${res.status}`);
  return res.json();
}

export { API_BASE };

// --- History ---

export async function fetchInterviewHistory() {
  const res = await fetch(`${API_BASE}/api/history/interviews`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
  return res.json();
}

export async function fetchInterviewStats() {
  const res = await fetch(`${API_BASE}/api/history/stats`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  return res.json();
}
