"""Tests for the scorer — deterministic fallback and reason capture."""
import pytest

from services import interview_scorer as scorer_mod
from services.interview_scorer import interview_scorer
from services.interview_tracker import InterviewTracker


def _tracker():
    graph = {
        "problem": "test",
        "concepts": {"db": {"name": "Database", "category": "storage"}},
        "concept_rubric_map": {"db": "database_design"},
    }
    t = InterviewTracker(knowledge_graph=graph, career_level="senior")
    t.messages = [
        {"role": "assistant", "content": "Design a URL shortener."},
        {"role": "user", "content": "I'll use a relational DB with a base62 id."},
    ]
    t.update({"concepts_mentioned": ["db"], "concept_depths": {"db": "applied"}})
    return t


async def test_deterministic_fallback_when_llm_unavailable(monkeypatch):
    async def no_llm(self, tracker):
        return None

    monkeypatch.setattr(scorer_mod.InterviewScorer, "_llm_score", no_llm)
    card = await interview_scorer.score(_tracker())

    assert 0 <= card["overall_score"] <= 100
    assert set(card["dimension_scores"]) == set(scorer_mod.RUBRIC_WEIGHTS)
    assert card["dimension_reasons"] == {}  # none from the deterministic path


async def test_llm_reasons_are_captured(monkeypatch):
    async def fake_generate_json(*a, **k):
        return {
            "dimensions": {
                "database_design": {"score": 8, "reason": "Chose a relational DB and justified base62 ids."},
                "scalability": {"score": 6, "reason": "Mentioned sharding but no numbers."},
            },
            "strengths": ["Solid DB reasoning"],
            "weaknesses": ["Light on capacity math"],
        }

    monkeypatch.setattr(scorer_mod.ollama_client, "generate_json", fake_generate_json)
    card = await interview_scorer.score(_tracker())

    assert card["dimension_reasons"]["database_design"].startswith("Chose a relational DB")
    assert card["dimension_scores"]["database_design"] == 8
    # Dimensions the LLM omitted are still backfilled.
    assert set(card["dimension_scores"]) == set(scorer_mod.RUBRIC_WEIGHTS)
