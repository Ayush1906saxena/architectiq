from pydantic import BaseModel


class InterviewStartRequest(BaseModel):
    problem_id: str
    career_level: str = "senior"  # sde2, senior, staff, principal, vp


class InterviewStartResponse(BaseModel):
    session_id: str
    opening_message: str
    problem_id: str = ""
    problem_title: str = ""
    state: dict


class InterviewMessageRequest(BaseModel):
    session_id: str
    message: str


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
