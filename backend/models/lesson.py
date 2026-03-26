from pydantic import BaseModel


class LessonSegment(BaseModel):
    id: str
    text: str
    avatar_emotion: str
    avatar_gesture: str
    diagram_state: str
    diagram_animations: list[str] = []
    pause_for_thought: bool = False
    thought_prompt: str | None = None
    duration_ms: int


class LessonData(BaseModel):
    topic_id: str
    lesson_id: str
    title: str
    description: str
    segments: list[LessonSegment]


class TTSRequest(BaseModel):
    text: str
    segment_id: str
    topic_id: str
    lesson_id: str


class WordTiming(BaseModel):
    word: str
    start_ms: int
    end_ms: int


class TTSResponse(BaseModel):
    audio_url: str
    duration_ms: int
    word_timings: list[WordTiming]
