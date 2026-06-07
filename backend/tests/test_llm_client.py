"""Tests for the LLM client's retry and fallback behavior."""
import pytest

from services import ollama_client as oc_mod
from services.ollama_client import LLMClient, LLMUnavailable


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    async def fast_sleep(*a, **k):
        return None
    monkeypatch.setattr(oc_mod.asyncio, "sleep", fast_sleep)


def _client():
    return LLMClient()


async def test_generate_json_retries_then_succeeds(monkeypatch):
    client = _client()
    calls = {"n": 0}

    async def fake_complete(messages, temperature, json_mode, max_tokens):
        calls["n"] += 1
        if calls["n"] < 3:
            raise LLMUnavailable("rate limited", status=429, retryable=True)
        return '{"ok": true}'

    monkeypatch.setattr(client, "_complete", fake_complete)
    result = await client.generate_json("prompt")
    assert result == {"ok": True}
    assert calls["n"] == 3  # two transient failures, then success


async def test_generate_json_gives_up_after_max_attempts(monkeypatch):
    client = _client()
    calls = {"n": 0}

    async def always_429(messages, temperature, json_mode, max_tokens):
        calls["n"] += 1
        raise LLMUnavailable("rate limited", status=429, retryable=True)

    monkeypatch.setattr(client, "_complete", always_429)
    assert await client.generate_json("prompt") is None
    assert calls["n"] == oc_mod._MAX_ATTEMPTS


async def test_non_retryable_fails_fast(monkeypatch):
    client = _client()
    calls = {"n": 0}

    async def auth_error(messages, temperature, json_mode, max_tokens):
        calls["n"] += 1
        raise LLMUnavailable("bad payload", status=400, retryable=False)

    monkeypatch.setattr(client, "_complete", auth_error)
    assert await client.generate_json("prompt") is None
    assert calls["n"] == 1  # no retries for non-retryable errors


async def test_generate_json_reprompts_on_bad_json(monkeypatch):
    client = _client()
    responses = ["not json at all", '{"ok": true}']

    async def fake_complete(messages, temperature, json_mode, max_tokens):
        return responses.pop(0)

    monkeypatch.setattr(client, "_complete", fake_complete)
    assert await client.generate_json("prompt") == {"ok": True}


async def test_generate_returns_fallback_on_failure(monkeypatch):
    client = _client()

    async def fail(messages, temperature, json_mode, max_tokens):
        raise LLMUnavailable("down", status=500, retryable=False)

    monkeypatch.setattr(client, "_complete", fail)
    assert await client.generate("prompt", fallback="FALLBACK") == "FALLBACK"


async def test_long_retry_after_fails_fast(monkeypatch):
    client = _client()
    calls = {"n": 0}

    async def slow_reset(messages, temperature, json_mode, max_tokens):
        calls["n"] += 1
        raise LLMUnavailable("rl", status=429, retryable=True, retry_after=60.0)

    monkeypatch.setattr(client, "_complete", slow_reset)
    assert await client.generate_json("prompt") is None
    assert calls["n"] == 1  # a 60s reset isn't worth waiting for — fail fast


async def test_short_retry_after_is_retried(monkeypatch):
    client = _client()
    calls = {"n": 0}

    async def fake(messages, temperature, json_mode, max_tokens):
        calls["n"] += 1
        if calls["n"] == 1:
            raise LLMUnavailable("rl", status=429, retryable=True, retry_after=2.0)
        return '{"ok": true}'

    monkeypatch.setattr(client, "_complete", fake)
    assert await client.generate_json("prompt") == {"ok": True}
    assert calls["n"] == 2


async def test_generate_default_429_message(monkeypatch):
    client = _client()

    async def rate_limited(messages, temperature, json_mode, max_tokens):
        raise LLMUnavailable("rl", status=429, retryable=False)

    monkeypatch.setattr(client, "_complete", rate_limited)
    msg = await client.generate("prompt")
    assert "moment" in msg.lower()
