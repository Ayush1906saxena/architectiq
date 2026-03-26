from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from config import settings
from models.lesson import TTSRequest, TTSResponse
from services.tts_service import tts_service

router = APIRouter()


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

    audio_url = f"/api/tts/audio/{request.topic_id}/{request.lesson_id}/{request.segment_id}.wav"

    return TTSResponse(
        audio_url=audio_url,
        duration_ms=duration_ms,
        word_timings=word_timings,
    )


@router.get("/tts/audio/{topic_id}/{lesson_id}/{segment_id}.wav")
async def serve_audio(topic_id: str, lesson_id: str, segment_id: str):
    from pathlib import Path

    audio_path = (
        Path(settings.tts_cache_dir) / topic_id / lesson_id / f"{segment_id}.wav"
    )
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(str(audio_path), media_type="audio/wav")
