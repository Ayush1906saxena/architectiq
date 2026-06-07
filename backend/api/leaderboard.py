"""Leaderboard endpoints."""
from fastapi import APIRouter, Depends

from middleware.auth import get_current_user
from db.database import get_db_ctx

router = APIRouter()

# One ranked query joining streaks — no per-row lookups, ranking done in SQL.
_RANKED_SQL = """
SELECT
    u.id AS user_id,
    u.username,
    u.display_name,
    ROUND(AVG(h.overall_score), 1) AS avg_score,
    COUNT(h.id) AS total_interviews,
    MAX(h.badge) AS best_badge,
    COALESCE(s.current_streak, 0) AS current_streak,
    COALESCE(s.longest_streak, 0) AS longest_streak,
    RANK() OVER (ORDER BY AVG(h.overall_score) DESC) AS rank
FROM interview_history h
JOIN users u ON u.id = h.user_id
LEFT JOIN user_streaks s ON s.user_id = u.id
WHERE h.completed_at IS NOT NULL
GROUP BY h.user_id
ORDER BY avg_score DESC
"""


@router.get("/leaderboard")
async def get_leaderboard():
    """Public leaderboard — top 20 users by average score."""
    async with get_db_ctx() as db:
        cursor = await db.execute(_RANKED_SQL + " LIMIT 20")
        rows = await cursor.fetchall()
    return [
        {
            "rank": row["rank"],
            "username": row["username"],
            "display_name": row["display_name"],
            "avg_score": row["avg_score"],
            "total_interviews": row["total_interviews"],
            "best_badge": row["best_badge"],
            "current_streak": row["current_streak"],
        }
        for row in rows
    ]


@router.get("/leaderboard/me")
async def get_my_rank(user: dict = Depends(get_current_user)):
    """Return the current user's rank and stats."""
    async with get_db_ctx() as db:
        # Total ranked users.
        cursor = await db.execute(
            "SELECT COUNT(DISTINCT user_id) AS n FROM interview_history WHERE completed_at IS NOT NULL"
        )
        total_users = (await cursor.fetchone())["n"]

        # The user's own ranked row, if they have completed interviews.
        cursor = await db.execute(
            f"SELECT * FROM ({_RANKED_SQL}) WHERE user_id = ?", (user["id"],)
        )
        row = await cursor.fetchone()

    if row:
        return {
            "rank": row["rank"],
            "total_users": total_users,
            "username": row["username"],
            "display_name": row["display_name"],
            "avg_score": row["avg_score"],
            "total_interviews": row["total_interviews"],
            "best_badge": row["best_badge"],
            "current_streak": row["current_streak"],
            "longest_streak": row["longest_streak"],
        }

    return {
        "rank": None,
        "total_users": total_users,
        "username": user["username"],
        "display_name": user.get("display_name", ""),
        "avg_score": None,
        "total_interviews": 0,
        "best_badge": None,
        "current_streak": 0,
        "longest_streak": 0,
    }
