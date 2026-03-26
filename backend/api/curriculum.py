import json
from pathlib import Path

from fastapi import APIRouter

from config import settings
from services.progress_service import progress_service

router = APIRouter()


@router.get("/curriculum")
async def get_curriculum():
    curriculum_path = Path(settings.content_dir) / "curriculum.json"
    if not curriculum_path.exists():
        return {"tiers": []}

    with open(curriculum_path) as f:
        curriculum = json.load(f)

    # Enrich with progress data
    progress = await progress_service.get_all_progress()
    mastery_map = {t.topic_id: t for t in progress.topics}
    lesson_map = {(l.topic_id, l.lesson_id): l for l in progress.lessons}

    for tier in curriculum.get("tiers", []):
        for module in tier.get("modules", []):
            slug = module.get("slug", "")
            mastery = mastery_map.get(slug)
            module["mastery"] = {
                "level": mastery.mastery_level if mastery else 0,
                "badge": mastery.badge if mastery else "none",
                "questions_attempted": mastery.questions_attempted if mastery else 0,
            }
            for lesson in module.get("lessons", []):
                lp = lesson_map.get((slug, lesson["id"]))
                lesson["completed"] = lp.completed if lp else False

    return curriculum
