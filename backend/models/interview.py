from pydantic import BaseModel, Field


class InterviewStartRequest(BaseModel):
    problem_id: str = Field(max_length=50)
    career_level: str = Field(default="senior", max_length=20)


class InterviewStartResponse(BaseModel):
    session_id: str
    opening_message: str
    problem_id: str = ""
    problem_title: str = ""
    state: dict


class InterviewMessageRequest(BaseModel):
    session_id: str = Field(max_length=64)
    message: str = Field(max_length=5000)


class InterviewMessageResponse(BaseModel):
    reply: str
    state: dict
    action_type: str = ""
    is_complete: bool = False
    scorecard: dict | None = None


class InterviewProblem(BaseModel):
    id: str
    title: str
    description: str = ""
