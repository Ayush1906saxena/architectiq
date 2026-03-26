import json

import httpx

from config import settings


class OllamaClient:
    def __init__(self):
        self._model = "llama3.2"

    async def generate(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.7,
        json_mode: bool = False,
    ) -> str:
        """Generate a completion from Ollama."""
        payload = {
            "model": self._model,
            "prompt": prompt,
            "system": system,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if json_mode:
            payload["format"] = "json"

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.ollama_url}/api/generate",
                    json=payload,
                )
                resp.raise_for_status()
                return resp.json().get("response", "")
        except Exception as e:
            return f"[Ollama unavailable: {str(e)}]"

    async def chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
    ) -> str:
        """Chat completion with message history."""
        payload = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.ollama_url}/api/chat",
                    json=payload,
                )
                resp.raise_for_status()
                return resp.json().get("message", {}).get("content", "")
        except Exception as e:
            return f"[Ollama unavailable: {str(e)}]"

    async def generate_quiz_question(
        self, topic: str, difficulty: int, context: str = ""
    ) -> dict | None:
        """Generate an adaptive quiz question as JSON."""
        system_prompt = (
            "You are a system design quiz generator. Generate a multiple-choice question "
            f"about '{topic}' at difficulty {difficulty}/10. "
            "Respond ONLY with valid JSON in this format: "
            '{"question": "...", "options": ["A...", "B...", "C...", "D..."], '
            '"correct_answer": 0, "explanation": "...", "difficulty": N, '
            '"tags": ["tag1", "tag2"]}'
        )
        prompt = f"Topic: {topic}\nDifficulty: {difficulty}/10\n"
        if context:
            prompt += f"Context: {context}\n"
        prompt += "Generate one quiz question."

        raw = await self.generate(prompt, system=system_prompt, json_mode=True)
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(f"{settings.ollama_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False


ollama_client = OllamaClient()
