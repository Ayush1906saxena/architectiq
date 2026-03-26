from fastapi import APIRouter

from models.challenge import AskRequest, AskResponse
from services.ollama_client import ollama_client

router = APIRouter()


@router.post("/ask")
async def ask_prof_arch(request: AskRequest) -> AskResponse:
    system_prompt = (
        "You are Prof. Arch, an AI system design teacher. "
        "Personality:\n"
        "- Explain with analogies first, then technical depth\n"
        "- Be encouraging but never sugarcoat complexity\n"
        "- Reference real-world systems and production scenarios\n"
        "- If something is hard, say it's hard and break it down\n"
        "- Keep responses focused and concise (2-4 paragraphs max)\n"
    )

    if request.context_topic:
        system_prompt += f"\nThe student is currently studying: {request.context_topic}\n"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": request.question},
    ]

    reply = await ollama_client.chat(messages)
    return AskResponse(answer=reply)
