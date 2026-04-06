from fastapi import APIRouter, Depends, HTTPException

from middleware.auth import get_optional_user
from models.interview import (
    InterviewStartRequest,
    InterviewStartResponse,
    InterviewMessageRequest,
    InterviewMessageResponse,
    InterviewProblem,
)
from services.interview_engine import interview_engine

router = APIRouter()


@router.get("/interview/problems")
async def list_problems() -> list[InterviewProblem]:
    """List available interview problems."""
    problems = interview_engine.list_problems()
    return [InterviewProblem(**p) for p in problems]


@router.post("/interview/start")
async def start_interview(
    request: InterviewStartRequest,
    user: dict | None = Depends(get_optional_user),
) -> InterviewStartResponse:
    """Start a new interview session."""
    if request.career_level not in ("sde2", "senior", "staff", "principal", "vp"):
        raise HTTPException(status_code=400, detail="Invalid career level")

    try:
        result = await interview_engine.start_session(
            problem_id=request.problem_id,
            career_level=request.career_level,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Save to history if user is logged in
    if user:
        from db.database import get_db

        db = await get_db()
        try:
            await db.execute(
                "INSERT INTO interview_history (user_id, session_id, problem_id, career_level) VALUES (?, ?, ?, ?)",
                (user["id"], result["session_id"], request.problem_id, request.career_level),
            )
            await db.commit()
        finally:
            await db.close()

    return InterviewStartResponse(**result)


@router.post("/interview/message")
async def send_message(request: InterviewMessageRequest) -> InterviewMessageResponse:
    """Send a message in an interview session."""
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    result = await interview_engine.process_message(
        session_id=request.session_id,
        user_message=request.message,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return InterviewMessageResponse(**result)


@router.post("/interview/{session_id}/end")
async def end_interview(session_id: str, user: dict | None = Depends(get_optional_user)):
    """End an interview early and get the scorecard."""
    scorecard = await interview_engine.get_scorecard(session_id)
    if not scorecard:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update history with results if user is logged in
    if user:
        import json
        from db.database import get_db

        db = await get_db()
        try:
            await db.execute(
                "UPDATE interview_history SET overall_score = ?, passed = ?, badge = ?, "
                "scorecard_json = ?, completed_at = CURRENT_TIMESTAMP "
                "WHERE session_id = ? AND user_id = ?",
                (
                    scorecard.get("overall_score"),
                    scorecard.get("passed"),
                    scorecard.get("badge"),
                    json.dumps(scorecard),
                    session_id,
                    user["id"],
                ),
            )
            await db.commit()
        finally:
            await db.close()

    return {"is_complete": True, "scorecard": scorecard}


@router.get("/interview/{session_id}/scorecard")
async def get_scorecard(session_id: str):
    """Get scorecard for a completed interview."""
    scorecard = await interview_engine.get_scorecard(session_id)
    if not scorecard:
        raise HTTPException(status_code=404, detail="Session not found")
    return scorecard


@router.get("/interview/{session_id}/state")
async def get_state(session_id: str):
    """Get current session state."""
    state = interview_engine.get_session_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return state
