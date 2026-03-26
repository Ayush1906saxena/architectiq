from pathlib import Path

import httpx
from fastapi import APIRouter

from config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    checks = {
        "status": "ok",
        "database": Path(settings.db_path).exists(),
        "content_dir": Path(settings.content_dir).is_dir(),
        "tts": _check_piper(),
        "ollama": await _check_ollama(),
    }
    if not all([checks["database"], checks["content_dir"]]):
        checks["status"] = "degraded"
    return checks


def _check_piper() -> bool:
    try:
        import piper  # noqa: F401
        return True
    except ImportError:
        return False


async def _check_ollama() -> bool:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.ollama_url}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False
