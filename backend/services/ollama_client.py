"""
LLM Client — supports Groq (cloud, free) and Ollama (local).

Groq uses the OpenAI-compatible chat completions API.
Ollama uses its native /api/generate and /api/chat endpoints.

The provider is selected via the LLM_PROVIDER env var ("groq" or "ollama").

Reliability:
- Transient failures (429, 5xx, timeouts, connection errors) are retried with
  exponential backoff before giving up.
- `generate()` returns a graceful prose fallback on final failure — this is what
  the speaker layer wants (a natural "could you repeat that?" line).
- `generate_json()` is the path for structured callers (analyzer, scorer, quiz).
  It never returns prose: it extracts JSON robustly (tolerating code fences and
  surrounding text), reprompts once on a parse failure, and returns None when the
  LLM is genuinely unavailable or the output can't be parsed — so callers can fall
  back to their deterministic logic instead of trying to json.loads() an apology.
"""
import asyncio
import json
import re

import httpx

from config import settings


# Transient HTTP statuses worth retrying.
_RETRY_STATUSES = {429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 3          # total attempts per call (1 try + 2 retries)
_BACKOFF_BASE = 0.5        # seconds; doubled each retry
_MAX_RETRY_WAIT = 12.0     # never block a turn longer than this for a rate-limit reset


class LLMUnavailable(Exception):
    """Raised when the LLM provider cannot be reached or errors after retries.

    `status` carries the HTTP status code when one is available (e.g. 429),
    `retryable` indicates whether retrying might help, and `retry_after` is the
    server-suggested wait in seconds (from the Retry-After header) when present.
    """

    def __init__(
        self,
        message: str,
        status: int | None = None,
        retryable: bool = True,
        retry_after: float | None = None,
    ):
        super().__init__(message)
        self.status = status
        self.retryable = retryable
        self.retry_after = retry_after


def extract_json(raw: str):
    """Best-effort extraction of a JSON object/array from an LLM response.

    Handles the common ways models wrap JSON despite being told not to:
    markdown code fences (```json ... ```) and a sentence before/after the JSON.
    Raises ValueError if no JSON can be recovered.
    """
    if not raw or not raw.strip():
        raise ValueError("empty response")

    text = raw.strip()

    # Strip a leading/trailing markdown code fence if present.
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()

    # Fast path: the whole thing is valid JSON.
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Slow path: slice from the first opening brace/bracket to the last close.
    candidates = [i for i in (text.find("{"), text.find("[")) if i != -1]
    if not candidates:
        raise ValueError("no JSON found in response")
    start = min(candidates)
    end = max(text.rfind("}"), text.rfind("]"))
    if end <= start:
        raise ValueError("no JSON close found in response")

    return json.loads(text[start:end + 1])


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

    # ── Public API ────────────────────────────────────────────

    async def generate(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.7,
        json_mode: bool = False,
        max_tokens: int = 320,
        fallback: str | None = None,
    ) -> str:
        """Generate a completion, returning a graceful prose fallback on failure.

        This is the path for the speaker layer, which always wants a usable string.
        The default max_tokens is small because interviewer turns are 2-4 sentences;
        keeping it tight conserves the provider's per-minute token budget. Pass
        `fallback` to override the default apology line. Structured callers should
        use `generate_json()` instead.
        """
        messages = self._build_messages(prompt, system)
        try:
            return await self._complete_with_retries(messages, temperature, json_mode, max_tokens)
        except LLMUnavailable as e:
            if fallback is not None:
                return fallback
            if e.status == 429:
                return "Let me gather my thoughts for a moment. Could you elaborate on your last point?"
            return "I missed that — could you repeat your last point?"

    async def generate_json(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ):
        """Generate and parse a JSON response. Returns the parsed value or None.

        Retries transient HTTP errors, tolerates code fences / surrounding prose,
        and reprompts once if the first response can't be parsed. Returns None when
        the provider is unavailable or the output is unparseable, so the caller can
        fall back to deterministic logic.
        """
        messages = self._build_messages(prompt, system)
        for attempt in range(2):
            try:
                raw = await self._complete_with_retries(messages, temperature, True, max_tokens)
            except LLMUnavailable:
                return None
            try:
                return extract_json(raw)
            except (ValueError, json.JSONDecodeError):
                if attempt == 0:
                    continue  # one clean retry for a parseable response
                return None
        return None

    async def chat(self, messages: list[dict], temperature: float = 0.7) -> str:
        """Chat completion with message history. Prose fallback on failure."""
        try:
            return await self._complete_with_retries(messages, temperature, False, 1024)
        except LLMUnavailable as e:
            if e.status == 429:
                return "Let me gather my thoughts for a moment. Could you elaborate on your last point?"
            return "I missed that — could you repeat your last point?"

    # ── Retry wrapper ─────────────────────────────────────────

    async def _complete_with_retries(
        self, messages: list[dict], temperature: float, json_mode: bool, max_tokens: int
    ) -> str:
        last_exc: LLMUnavailable | None = None
        for attempt in range(_MAX_ATTEMPTS):
            try:
                return await self._complete(messages, temperature, json_mode, max_tokens)
            except LLMUnavailable as e:
                last_exc = e
                if not e.retryable or attempt == _MAX_ATTEMPTS - 1:
                    raise
                # Honor a server-provided Retry-After when it's short enough to be
                # worth waiting (rate-limit windows reset quickly); otherwise fail
                # fast to the caller's fallback rather than stalling the turn.
                if e.retry_after is not None:
                    if e.retry_after > _MAX_RETRY_WAIT:
                        raise
                    wait = e.retry_after
                else:
                    wait = _BACKOFF_BASE * (2 ** attempt)
                await asyncio.sleep(wait)
        raise last_exc  # pragma: no cover — loop always returns or raises

    async def _complete(
        self, messages: list[dict], temperature: float, json_mode: bool, max_tokens: int
    ) -> str:
        """One provider call. Raises LLMUnavailable on any failure."""
        if self._provider == "groq":
            return await self._groq_complete(messages, temperature, json_mode, max_tokens)
        return await self._ollama_complete(messages, temperature, json_mode, max_tokens)

    @staticmethod
    def _build_messages(prompt: str, system: str) -> list[dict]:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return messages

    # ── Groq (OpenAI-compatible) ──────────────────────────────

    async def _groq_complete(
        self, messages: list[dict], temperature: float, json_mode: bool, max_tokens: int
    ) -> str:
        payload = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
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
            status = e.response.status_code
            retry_after = None
            if status == 429:
                ra = e.response.headers.get("retry-after")
                if ra:
                    try:
                        retry_after = float(ra)
                    except ValueError:
                        retry_after = None
            raise LLMUnavailable(
                f"Groq returned {status}", status=status,
                retryable=status in _RETRY_STATUSES, retry_after=retry_after,
            ) from e
        except (httpx.TimeoutException, httpx.TransportError) as e:
            raise LLMUnavailable(f"Groq request failed: {e}", retryable=True) from e
        except (KeyError, IndexError, ValueError) as e:
            raise LLMUnavailable(f"Groq returned an unexpected payload: {e}", retryable=False) from e

    # ── Ollama (local) ────────────────────────────────────────

    async def _ollama_complete(
        self, messages: list[dict], temperature: float, json_mode: bool, max_tokens: int
    ) -> str:
        # Ollama's /api/chat takes the message list directly.
        payload = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        if json_mode:
            payload["format"] = "json"

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(f"{self._base_url}/api/chat", json=payload)
                resp.raise_for_status()
                content = resp.json().get("message", {}).get("content", "")
                if not content:
                    raise LLMUnavailable("Ollama returned empty content", retryable=False)
                return content
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            raise LLMUnavailable(
                f"Ollama returned {status}", status=status, retryable=status in _RETRY_STATUSES
            ) from e
        except (httpx.TimeoutException, httpx.TransportError) as e:
            raise LLMUnavailable(f"Ollama request failed: {e}", retryable=True) from e

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

        parsed = await self.generate_json(prompt, system=system_prompt)
        return parsed if isinstance(parsed, dict) else None

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
