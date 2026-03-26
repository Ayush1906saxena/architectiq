from pydantic import BaseModel


class TopicMastery(BaseModel):
    topic_id: str
    mastery_level: float = 0.0
    badge: str = "none"
    questions_attempted: int = 0
    questions_correct: int = 0
    current_difficulty: int = 1
    next_review_at: str | None = None


class LessonProgressItem(BaseModel):
    topic_id: str
    lesson_id: str
    completed: bool = False
    last_segment_index: int = 0


class ProgressSummary(BaseModel):
    topics: list[TopicMastery]
    lessons: list[LessonProgressItem]
    total_lessons_completed: int = 0
    total_quizzes_taken: int = 0
