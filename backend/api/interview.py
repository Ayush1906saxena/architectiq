from fastapi import APIRouter, HTTPException

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
async def start_interview(request: InterviewStartRequest) -> InterviewStartResponse:
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
async def end_interview(session_id: str):
    """End an interview early and get the scorecard."""
    scorecard = await interview_engine.get_scorecard(session_id)
    if not scorecard:
        raise HTTPException(status_code=404, detail="Session not found")
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
