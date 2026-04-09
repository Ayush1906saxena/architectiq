"""Daily challenge and streak endpoints."""
import random
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from middleware.auth import get_current_user
from db.database import get_db
from services.interview_engine import interview_engine

router = APIRouter()


def _today() -> str:
    return date.today().isoformat()


async def _ensure_challenge(db) -> dict:
    """Return today's challenge, creating one if it doesn't exist."""
    today = _today()
    cursor = await db.execute(
        "SELECT problem_id, career_level FROM daily_challenges WHERE challenge_date = ?",
        (today,),
    )
    row = await cursor.fetchone()
    if row:
        return dict(row)

    # Pick a random problem
    problems = interview_engine.list_problems()
    if not problems:
        raise HTTPException(500, "No problems available")
    chosen = random.choice(problems)
    problem_id = chosen["id"]
    career_level = "senior"

    await db.execute(
        "INSERT INTO daily_challenges (challenge_date, problem_id, career_level) VALUES (?, ?, ?)",
        (today, problem_id, career_level),
    )
    await db.commit()
    return {"problem_id": problem_id, "career_level": career_level}


@router.get("/daily/challenge")
async def get_daily_challenge(user: dict = Depends(get_current_user)):
    """Return today's daily challenge."""
    db = await get_db()
    try:
        challenge = await _ensure_challenge(db)
        return {
            "challenge_date": _today(),
            "problem_id": challenge["problem_id"],
            "career_level": challenge["career_level"],
        }
    finally:
        await db.close()


@router.get("/daily/streak")
async def get_streak(user: dict = Depends(get_current_user)):
    """Return the user's streak info and whether today's challenge is completed."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT current_streak, longest_streak, last_challenge_date FROM user_streaks WHERE user_id = ?",
            (user["id"],),
        )
        row = await cursor.fetchone()
        if row:
            streak = dict(row)
        else:
            streak = {"current_streak": 0, "longest_streak": 0, "last_challenge_date": None}

        completed_today = streak["last_challenge_date"] == _today()
        return {
            "current_streak": streak["current_streak"],
            "longest_streak": streak["longest_streak"],
            "completed_today": completed_today,
        }
    finally:
        await db.close()


class CompleteRequest(BaseModel):
    session_id: str


@router.post("/daily/complete")
async def complete_daily(body: CompleteRequest, user: dict = Depends(get_current_user)):
    """Mark today's daily challenge as completed and update the streak."""
    db = await get_db()
    try:
        # Verify the session belongs to today's challenge and to this user
        today = _today()
        challenge = await _ensure_challenge(db)

        cursor = await db.execute(
            "SELECT id FROM interview_history WHERE session_id = ? AND user_id = ? AND problem_id = ?",
            (body.session_id, user["id"], challenge["problem_id"]),
        )
        if not await cursor.fetchone():
            raise HTTPException(400, "Session does not match today's daily challenge")

        # Get current streak record
        cursor = await db.execute(
            "SELECT current_streak, longest_streak, last_challenge_date FROM user_streaks WHERE user_id = ?",
            (user["id"],),
        )
        row = await cursor.fetchone()

        yesterday = (date.today() - timedelta(days=1)).isoformat()

        if row:
            streak = dict(row)
            if streak["last_challenge_date"] == today:
                # Already completed today — no-op
                return {"current_streak": streak["current_streak"], "longest_streak": streak["longest_streak"]}

            if streak["last_challenge_date"] == yesterday:
                new_current = streak["current_streak"] + 1
            else:
                new_current = 1

            new_longest = max(streak["longest_streak"], new_current)
            await db.execute(
                "UPDATE user_streaks SET current_streak = ?, longest_streak = ?, last_challenge_date = ? WHERE user_id = ?",
                (new_current, new_longest, today, user["id"]),
            )
        else:
            new_current = 1
            new_longest = 1
            await db.execute(
                "INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_challenge_date) VALUES (?, ?, ?, ?)",
                (user["id"], 1, 1, today),
            )

        await db.commit()
        return {"current_streak": new_current, "longest_streak": new_longest}
    finally:
        await db.close()
