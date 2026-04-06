export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface DesignChallengeRequest {
  topic_id: string;
  challenge_id: string;
  messages: ChatMessage[];
}

export interface DesignChallengeResponse {
  reply: string;
  is_complete: boolean;
  score: number | null;
  feedback: string | null;
}

export interface AskRequest {
  question: string;
  context_topic?: string;
}

export interface AskResponse {
  answer: string;
}
