import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from config import settings
from models.lesson import LessonData

router = APIRouter()

# Cache the curriculum lookup on first load
_curriculum_cache: dict[str, dict] | None = None


def _load_curriculum() -> dict[str, dict]:
    global _curriculum_cache
    if _curriculum_cache is not None:
        return _curriculum_cache

    curriculum_path = Path(settings.content_dir) / "curriculum.json"
    if not curriculum_path.exists():
        raise HTTPException(status_code=500, detail="curriculum.json not found")

    with open(curriculum_path) as f:
        data = json.load(f)

    # Build a lookup: topic_slug -> { path, lessons: { lesson_id -> lesson_path } }
    lookup: dict[str, dict] = {}
    for tier in data.get("tiers", []):
        for module in tier.get("modules", []):
            slug = module["slug"]
            lookup[slug] = {
                "path": module["path"],
                "lessons": {},
            }
            for lesson in module.get("lessons", []):
                lookup[slug]["lessons"][lesson["id"]] = lesson["path"]

    _curriculum_cache = lookup
    return lookup


def _get_module_lessons(topic_id: str) -> list[dict]:
    """Get ordered list of lessons in a module with titles."""
    curriculum_path = Path(settings.content_dir) / "curriculum.json"
    if not curriculum_path.exists():
        return []

    with open(curriculum_path) as f:
        data = json.load(f)

    for tier in data.get("tiers", []):
        for module in tier.get("modules", []):
            if module["slug"] == topic_id:
                return module.get("lessons", [])
    return []


@router.get("/lessons/{topic_id}/{lesson_id}")
async def get_lesson(topic_id: str, lesson_id: str) -> LessonData:
    curriculum = _load_curriculum()

    if topic_id not in curriculum:
        raise HTTPException(status_code=404, detail=f"Topic '{topic_id}' not found")

    topic = curriculum[topic_id]
    if lesson_id not in topic["lessons"]:
        raise HTTPException(
            status_code=404, detail=f"Lesson '{lesson_id}' not found in topic '{topic_id}'"
        )

    lesson_path = Path(settings.content_dir) / topic["lessons"][lesson_id] / "lesson.json"
    if not lesson_path.exists():
        raise HTTPException(status_code=404, detail="lesson.json not found on disk")

    with open(lesson_path) as f:
        lesson_data = json.load(f)

    return LessonData(**lesson_data)


@router.get("/lessons/{topic_id}/module-lessons")
async def get_module_lessons(topic_id: str):
    """Get all lessons in a module with navigation info."""
    lessons = _get_module_lessons(topic_id)
    if not lessons:
        raise HTTPException(status_code=404, detail=f"No lessons found for topic '{topic_id}'")
    return {"topic_id": topic_id, "lessons": lessons}


@router.get("/lessons/{topic_id}/{lesson_id}/diagram-states")
async def get_diagram_states(topic_id: str, lesson_id: str):
    curriculum = _load_curriculum()

    if topic_id not in curriculum or lesson_id not in curriculum[topic_id]["lessons"]:
        raise HTTPException(status_code=404, detail="Not found")

    states_path = (
        Path(settings.content_dir)
        / curriculum[topic_id]["lessons"][lesson_id]
        / "diagram-states.json"
    )
    if not states_path.exists():
        raise HTTPException(status_code=404, detail="diagram-states.json not found")

    with open(states_path) as f:
        return json.load(f)
