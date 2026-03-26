from fastapi import APIRouter, HTTPException

from models.quiz import QuizBank, QuizSubmission, QuizResult, AdaptiveQuizRequest, QuizQuestion
from services.quiz_service import quiz_service

router = APIRouter()


@router.get("/quiz/{topic_id}")
async def get_quiz(topic_id: str) -> QuizBank:
    bank = await quiz_service.get_quiz_bank(topic_id)
    if not bank:
        raise HTTPException(status_code=404, detail=f"No quiz bank for topic '{topic_id}'")
    return bank


@router.post("/quiz/submit")
async def submit_quiz_answer(submission: QuizSubmission) -> QuizResult:
    bank = await quiz_service.get_quiz_bank(submission.topic_id)
    if not bank:
        raise HTTPException(status_code=404, detail="Quiz bank not found")

    question = next((q for q in bank.questions if q.id == submission.question_id), None)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    mastery_update = await quiz_service.submit_answer(
        topic_id=submission.topic_id,
        question_id=submission.question_id,
        selected=submission.selected_answer,
        correct=question.correct_answer,
        difficulty=question.difficulty,
        time_ms=submission.time_taken_ms,
    )

    return QuizResult(
        is_correct=submission.selected_answer == question.correct_answer,
        correct_answer=question.correct_answer,
        explanation=question.explanation,
        mastery_update=mastery_update,
    )


@router.post("/quiz/adaptive")
async def get_adaptive_question(request: AdaptiveQuizRequest) -> QuizQuestion:
    question = await quiz_service.get_adaptive_question(
        topic_id=request.topic_id,
        difficulty=request.current_difficulty,
        context=request.previous_question,
    )
    if not question:
        raise HTTPException(status_code=503, detail="Could not generate adaptive question")
    return question
