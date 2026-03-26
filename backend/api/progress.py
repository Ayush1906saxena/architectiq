from fastapi import APIRouter

from models.progress import ProgressSummary, TopicMastery
from services.progress_service import progress_service

router = APIRouter()


@router.get("/progress")
async def get_progress() -> ProgressSummary:
    return await progress_service.get_all_progress()


@router.get("/progress/{topic_id}")
async def get_topic_progress(topic_id: str) -> TopicMastery:
    return await progress_service.get_topic_mastery(topic_id)


@router.get("/review-queue")
async def get_review_queue() -> list[TopicMastery]:
    return await progress_service.get_review_queue()
