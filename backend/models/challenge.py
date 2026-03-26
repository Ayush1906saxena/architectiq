from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class DesignChallengeRequest(BaseModel):
    topic_id: str
    challenge_id: str
    messages: list[ChatMessage]


class DesignChallengeResponse(BaseModel):
    reply: str
    is_complete: bool = False
    score: float | None = None
    feedback: str | None = None


class AskRequest(BaseModel):
    question: str
    context_topic: str | None = None


class AskResponse(BaseModel):
    answer: str
