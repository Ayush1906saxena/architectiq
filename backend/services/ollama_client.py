"""
LLM Client — supports Groq (cloud, free) and Ollama (local).

Groq uses the OpenAI-compatible chat completions API.
Ollama uses its native /api/generate and /api/chat endpoints.

The provider is selected via the LLM_PROVIDER env var ("groq" or "ollama").
"""
import json

import httpx

from config import settings


class LLMClient:
    def __init__(self):
        self._provider = settings.llm_provider.lower()

        if self._provider == "groq":
            self._api_key = settings.groq_api_key
            self._model = settings.groq_model
            self._base_url = "https://api.groq.com/openai/v1"
            if not self._api_key:
                print("WARNING: GROQ_API_KEY not set. LLM calls will fail.")
                print("  Get a free key at https://console.groq.com")
                print("  Then set: export GROQ_API_KEY=gsk_...")
        else:
            self._model = settings.ollama_model
            self._base_url = settings.ollama_url

    async def generate(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.7,
        json_mode: bool = False,
    ) -> str:
        """Generate a completion. Works with both Groq and Ollama."""
        if self._provider == "groq":
            return await self._groq_generate(prompt, system, temperature, json_mode)
        else:
            return await self._ollama_generate(prompt, system, temperature, json_mode)

    async def chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
    ) -> str:
        """Chat completion with message history."""
        if self._provider == "groq":
            return await self._groq_chat(messages, temperature)
        else:
            return await self._ollama_chat(messages, temperature)

    # ── Groq (OpenAI-compatible) ──────────────────────────────

    async def _groq_generate(
        self, prompt: str, system: str, temperature: float, json_mode: bool
    ) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1024,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self._base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                return "Let me gather my thoughts for a moment. Could you elaborate on your last point?"
            return "I missed that — could you repeat your last point?"
        except Exception:
            return "I missed that — could you repeat your last point?"

    async def _groq_chat(self, messages: list[dict], temperature: float) -> str:
        payload = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1024,
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self._base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                return "Let me gather my thoughts for a moment. Could you elaborate on your last point?"
            return "I missed that — could you repeat your last point?"
        except Exception:
            return "I missed that — could you repeat your last point?"

    # ── Ollama (local) ────────────────────────────────────────

    async def _ollama_generate(
        self, prompt: str, system: str, temperature: float, json_mode: bool
    ) -> str:
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
                    f"{self._base_url}/api/generate",
                    json=payload,
                )
                resp.raise_for_status()
                return resp.json().get("response", "")
        except Exception as e:
            return "I missed that — could you repeat your last point?"

    async def _ollama_chat(self, messages: list[dict], temperature: float) -> str:
        payload = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self._base_url}/api/chat",
                    json=payload,
                )
                resp.raise_for_status()
                return resp.json().get("message", {}).get("content", "")
        except Exception as e:
            return "I missed that — could you repeat your last point?"

    # ── Shared utilities ──────────────────────────────────────

    async def generate_quiz_question(
        self, topic: str, difficulty: int, context: str = ""
    ) -> dict | None:
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
            if self._provider == "groq":
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(
                        f"{self._base_url}/models",
                        headers={"Authorization": f"Bearer {self._api_key}"},
                    )
                    return resp.status_code == 200
            else:
                async with httpx.AsyncClient(timeout=2.0) as client:
                    resp = await client.get(f"{self._base_url}/api/tags")
                    return resp.status_code == 200
        except Exception:
            return False


# Singleton — same interface as before, backward compatible
ollama_client = LLMClient()
