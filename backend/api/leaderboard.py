"""Leaderboard endpoints."""
from fastapi import APIRouter, Depends

from middleware.auth import get_current_user
from db.database import get_db

router = APIRouter()


async def _ranked_query(db):
    """Return the full ranked leaderboard query as a list of dicts."""
    cursor = await db.execute(
        "SELECT u.id AS user_id, u.username, u.display_name, "
        "ROUND(AVG(h.overall_score), 1) AS avg_score, "
        "COUNT(h.id) AS total_interviews, "
        "MAX(h.badge) AS best_badge "
        "FROM interview_history h "
        "JOIN users u ON u.id = h.user_id "
        "WHERE h.completed_at IS NOT NULL "
        "GROUP BY h.user_id "
        "ORDER BY avg_score DESC"
    )
    return await cursor.fetchall()


@router.get("/leaderboard")
async def get_leaderboard():
    """Public leaderboard — top 20 users by average score."""
    db = await get_db()
    try:
        rows = await _ranked_query(db)
        result = []
        for rank, row in enumerate(rows[:20], start=1):
            entry = dict(row)
            # Fetch streak
            cursor = await db.execute(
                "SELECT current_streak FROM user_streaks WHERE user_id = ?",
                (entry["user_id"],),
            )
            streak_row = await cursor.fetchone()
            result.append({
                "rank": rank,
                "username": entry["username"],
                "display_name": entry["display_name"],
                "avg_score": entry["avg_score"],
                "total_interviews": entry["total_interviews"],
                "best_badge": entry["best_badge"],
                "current_streak": dict(streak_row)["current_streak"] if streak_row else 0,
            })
        return result
    finally:
        await db.close()


@router.get("/leaderboard/me")
async def get_my_rank(user: dict = Depends(get_current_user)):
    """Return the current user's rank and stats."""
    db = await get_db()
    try:
        rows = await _ranked_query(db)
        for rank, row in enumerate(rows, start=1):
            entry = dict(row)
            if entry["user_id"] == user["id"]:
                cursor = await db.execute(
                    "SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = ?",
                    (user["id"],),
                )
                streak_row = await cursor.fetchone()
                streak = dict(streak_row) if streak_row else {"current_streak": 0, "longest_streak": 0}
                return {
                    "rank": rank,
                    "total_users": len(rows),
                    "username": entry["username"],
                    "display_name": entry["display_name"],
                    "avg_score": entry["avg_score"],
                    "total_interviews": entry["total_interviews"],
                    "best_badge": entry["best_badge"],
                    "current_streak": streak["current_streak"],
                    "longest_streak": streak["longest_streak"],
                }
        # User has no completed interviews
        return {
            "rank": None,
            "total_users": len(rows),
            "username": user["username"],
            "display_name": user.get("display_name", ""),
            "avg_score": None,
            "total_interviews": 0,
            "best_badge": None,
            "current_streak": 0,
            "longest_streak": 0,
        }
    finally:
        await db.close()
