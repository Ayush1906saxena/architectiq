"""Interview history endpoints — scoped to the authenticated user."""
import json

from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import get_current_user
from db.database import get_db

router = APIRouter()


@router.get("/history/interviews")
async def list_interviews(user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, problem_id, career_level, overall_score, passed, badge, started_at, completed_at "
            "FROM interview_history WHERE user_id = ? ORDER BY started_at DESC",
            (user["id"],),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


@router.get("/history/interviews/{history_id}")
async def get_interview_detail(history_id: int, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM interview_history WHERE id = ? AND user_id = ?",
            (history_id, user["id"]),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "Interview not found")
        result = dict(row)
        if result.get("scorecard_json"):
            result["scorecard"] = json.loads(result["scorecard_json"])
            del result["scorecard_json"]
        result.pop("transcript_json", None)
        return result
    finally:
        await db.close()


@router.get("/history/interviews/{history_id}/replay")
async def get_interview_replay(history_id: int, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, problem_id, career_level, overall_score, passed, badge, "
            "scorecard_json, transcript_json, started_at, completed_at "
            "FROM interview_history WHERE id = ? AND user_id = ?",
            (history_id, user["id"]),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "Interview not found")
        result = dict(row)
        if result.get("scorecard_json"):
            result["scorecard"] = json.loads(result["scorecard_json"])
            del result["scorecard_json"]
        else:
            result["scorecard"] = None
        if result.get("transcript_json"):
            result["transcript"] = json.loads(result["transcript_json"])
            del result["transcript_json"]
        else:
            result["transcript"] = []
        return result
    finally:
        await db.close()


@router.get("/history/stats")
async def get_stats(user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT COUNT(*) as total, "
            "SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed, "
            "ROUND(AVG(overall_score), 1) as avg_score, "
            "MAX(overall_score) as best_score "
            "FROM interview_history WHERE user_id = ? AND completed_at IS NOT NULL",
            (user["id"],),
        )
        row = await cursor.fetchone()
        return dict(row)
    finally:
        await db.close()
