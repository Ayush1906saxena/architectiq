from pydantic import BaseModel


class QuizQuestion(BaseModel):
    id: str
    topic_id: str
    question: str
    options: list[str]
    correct_answer: int  # index into options
    explanation: str
    wrong_explanations: dict[str, str] = {}
    difficulty: int
    tags: list[str] = []


class QuizBank(BaseModel):
    topic_id: str
    questions: list[QuizQuestion]


class QuizSubmission(BaseModel):
    topic_id: str
    question_id: str
    selected_answer: int
    time_taken_ms: int = 0


class MasteryUpdate(BaseModel):
    new_mastery: float
    new_badge: str | None = None
    difficulty_change: int = 0


class QuizResult(BaseModel):
    is_correct: bool
    correct_answer: int
    explanation: str
    mastery_update: MasteryUpdate


class AdaptiveQuizRequest(BaseModel):
    topic_id: str
    current_difficulty: int
    previous_question: str = ""
    previous_answer: str = ""
