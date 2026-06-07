"""Tests for the response analyzer — stuck detection and signal wiring."""
import pytest

from services import response_analyzer as ra_mod
from services.response_analyzer import response_analyzer, _is_explicit_stuck


def _patch_llm(monkeypatch, return_value):
    async def fake(*a, **k):
        return return_value
    monkeypatch.setattr(ra_mod.ollama_client, "generate_json", fake)


# ── The "nosql" substring bug ─────────────────────────────────

def test_explicit_stuck_helper_does_not_match_inside_words():
    assert _is_explicit_stuck("no")
    assert _is_explicit_stuck("i don't know")
    # The old code matched "no" inside "nosql" and flagged this as a give-up.
    assert not _is_explicit_stuck("i'd use a nosql store")
    assert not _is_explicit_stuck("nope, kafka handles the ordering")  # 'nope' only as exact


async def test_nosql_answer_not_flagged_stuck(monkeypatch):
    _patch_llm(monkeypatch, None)  # force keyword fallback
    result = await response_analyzer.analyze("I'd use DynamoDB, a NoSQL store for the key-value data", "")
    assert result.is_stuck is False
    assert result.concepts_mentioned  # dynamodb recognized


async def test_explicit_give_up_short_circuits(monkeypatch):
    called = {"llm": False}

    async def fake(*a, **k):
        called["llm"] = True
        return None

    monkeypatch.setattr(ra_mod.ollama_client, "generate_json", fake)
    result = await response_analyzer.analyze("I don't know", "")
    assert result.is_stuck is True
    assert called["llm"] is False  # never bothered the LLM


# ── is_asking_question wiring ─────────────────────────────────

async def test_question_detected_via_punctuation(monkeypatch):
    _patch_llm(monkeypatch, {"concepts": []})
    result = await response_analyzer.analyze("How many requests per second do we expect?", "")
    assert result.is_asking_question is True


async def test_question_detected_via_llm_without_punctuation(monkeypatch):
    _patch_llm(monkeypatch, {"concepts": [], "is_asking_question": True})
    result = await response_analyzer.analyze("I want to confirm the expected scale", "")
    assert result.is_asking_question is True


# ── keyword fallback ──────────────────────────────────────────

async def test_keyword_fallback_extracts_concepts(monkeypatch):
    _patch_llm(monkeypatch, None)
    result = await response_analyzer.analyze(
        "I'll put Redis in front of the database and use consistent hashing to shard", ""
    )
    assert "redis" in result.concepts_mentioned
    assert "consistent_hashing" in result.concepts_mentioned
