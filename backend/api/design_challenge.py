import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from config import settings
from models.challenge import DesignChallengeRequest, DesignChallengeResponse
from services.ollama_client import ollama_client

router = APIRouter()


def _load_challenge(challenge_id: str) -> dict | None:
    path = Path(settings.content_dir) / "challenges" / f"{challenge_id}.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return None


@router.post("/design-challenge")
async def design_challenge(request: DesignChallengeRequest) -> DesignChallengeResponse:
    challenge = _load_challenge(request.challenge_id)

    system_prompt = (
        "You are a senior system design interviewer at a top tech company. "
        "The candidate is solving a design problem. "
        "Your behavior:\n"
        "1. Let them drive the design. Don't give answers.\n"
        "2. If they're stuck for > 2 exchanges, give a gentle hint.\n"
        "3. Push on trade-offs: 'Why X over Y?'\n"
        "4. Keep responses concise (2-4 sentences).\n"
        "5. After they present their design, probe failure scenarios.\n"
    )

    if challenge:
        system_prompt += f"\nDesign problem: {challenge.get('title', request.challenge_id)}\n"
        system_prompt += f"Key requirements: {json.dumps(challenge.get('requirements', []))}\n"

    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})

    reply = await ollama_client.chat(messages)

    is_complete = len(request.messages) >= 20  # End after ~20 turns
    score = None
    feedback = None

    if is_complete:
        eval_prompt = (
            "Based on this design conversation, score the candidate 0-100 and give "
            "brief feedback on: requirements coverage, scalability, trade-off awareness, "
            "and communication clarity. Respond as JSON: "
            '{"score": N, "feedback": "..."}'
        )
        messages.append({"role": "assistant", "content": reply})
        messages.append({"role": "user", "content": eval_prompt})
        eval_raw = await ollama_client.chat(messages)
        try:
            eval_data = json.loads(eval_raw)
            score = eval_data.get("score")
            feedback = eval_data.get("feedback")
        except (json.JSONDecodeError, TypeError):
            feedback = eval_raw

    return DesignChallengeResponse(
        reply=reply,
        is_complete=is_complete,
        score=score,
        feedback=feedback,
    )
