import hashlib
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import settings
from models.lesson import TTSRequest, TTSResponse
from services.tts_service import tts_service

router = APIRouter()


class InterviewTTSRequest(BaseModel):
    text: str


class InterviewTTSResponse(BaseModel):
    audio_url: str
    duration_ms: int


@router.post("/tts/interview")
async def generate_interview_tts(request: InterviewTTSRequest) -> InterviewTTSResponse:
    """Generate TTS for an interviewer response. Uses content-hash for caching."""
    text_hash = hashlib.md5(request.text.encode()).hexdigest()[:12]
    try:
        audio_path, duration_ms, _ = await tts_service.generate(
            text=request.text,
            topic_id="interview",
            lesson_id="responses",
            segment_id=text_hash,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

    # Return URL matching the actual file extension
    ext = audio_path.suffix  # .mp3 or .wav
    return InterviewTTSResponse(
        audio_url=f"/api/tts/audio/interview/responses/{text_hash}{ext}",
        duration_ms=duration_ms,
    )


@router.post("/tts")
async def generate_tts(request: TTSRequest) -> TTSResponse:
    try:
        audio_path, duration_ms, word_timings = await tts_service.generate(
            text=request.text,
            topic_id=request.topic_id,
            lesson_id=request.lesson_id,
            segment_id=request.segment_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

    ext = audio_path.suffix
    audio_url = f"/api/tts/audio/{request.topic_id}/{request.lesson_id}/{request.segment_id}{ext}"

    return TTSResponse(
        audio_url=audio_url,
        duration_ms=duration_ms,
        word_timings=word_timings,
    )


@router.get("/tts/audio/{topic_id}/{lesson_id}/{filename}")
async def serve_audio(topic_id: str, lesson_id: str, filename: str):
    audio_path = Path(settings.tts_cache_dir) / topic_id / lesson_id / filename
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    media_type = "audio/mpeg" if filename.endswith(".mp3") else "audio/wav"
    return FileResponse(str(audio_path), media_type=media_type)
