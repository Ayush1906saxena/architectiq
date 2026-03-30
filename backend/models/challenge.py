from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]  # Block "system" role injection
    content: str = Field(max_length=5000)


class DesignChallengeRequest(BaseModel):
    topic_id: str = Field(max_length=50)
    challenge_id: str = Field(max_length=50)
    messages: list[ChatMessage] = Field(max_length=50)  # max 50 messages in history


class DesignChallengeResponse(BaseModel):
    reply: str
    is_complete: bool = False
    score: float | None = None
    feedback: str | None = None


class AskRequest(BaseModel):
    question: str = Field(max_length=2000)
    context_topic: str | None = Field(default=None, max_length=100)


class AskResponse(BaseModel):
    answer: str
