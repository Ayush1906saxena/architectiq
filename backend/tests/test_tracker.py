"""Tests for the deterministic interview tracker."""
import pytest

from services.interview_tracker import (
    InterviewTracker, Phase, Depth, PHASE_ORDER, _claims_conflict,
)


def _graph():
    return {
        "problem": "test",
        "concepts": {
            "db": {"name": "Database", "category": "storage"},
            "cache": {"name": "Caching", "category": "caching"},
        },
        "concept_rubric_map": {"db": "database_design", "cache": "caching_strategy"},
    }


def _tracker(level="senior"):
    return InterviewTracker(knowledge_graph=_graph(), career_level=level)


# ── Depth ─────────────────────────────────────────────────────

def test_depth_only_upgrades():
    t = _tracker()
    t.update({"concepts_mentioned": ["db"], "concept_depths": {"db": "applied"}})
    assert t.covered_concepts["db"] == Depth.APPLIED
    # A later shallower mention must NOT downgrade.
    t.update({"concepts_mentioned": ["db"], "concept_depths": {"db": "buzzword"}})
    assert t.covered_concepts["db"] == Depth.APPLIED


def test_rubric_accrues_from_depth():
    t = _tracker()
    t.update({"concepts_mentioned": ["db"], "concept_depths": {"db": "deep"}})
    assert t.rubric_scores["database_design"] > 0


# ── Phase transitions ─────────────────────────────────────────

def test_peek_next_phase_is_pure():
    t = _tracker()
    assert t.phase == Phase.REQUIREMENTS
    assert t.peek_next_phase() == Phase.HIGH_LEVEL
    # Peeking must not advance anything.
    assert t.phase == Phase.REQUIREMENTS
    assert t.phase_index == 0


def test_transition_phase_advances():
    t = _tracker()
    new_phase = t.transition_phase()
    assert new_phase == Phase.HIGH_LEVEL
    assert t.phase == Phase.HIGH_LEVEL
    assert t.phase_index == 1


def test_transition_walks_full_order_to_wrap_up():
    t = _tracker()
    for expected in PHASE_ORDER[1:]:
        assert t.transition_phase() == expected
    # Past the end stays at WRAP_UP.
    assert t.transition_phase() == Phase.WRAP_UP


# ── Contradiction detection ───────────────────────────────────

def test_real_stance_reversal_is_flagged():
    t = _tracker()
    t.update({"claims": [{"claim": "I'll use eventual consistency across the board", "concept": "db", "justified": True}]})
    t.update({"claims": [{"claim": "Actually we need strong consistency for payments", "concept": "db", "justified": True}]})
    assert len(t.contradictions) == 1


def test_two_statements_same_concept_not_flagged():
    t = _tracker()
    t.update({"claims": [{"claim": "I'll use Redis for caching the hot keys", "concept": "cache", "justified": True}]})
    t.update({"claims": [{"claim": "Redis also helps with rate limiting counters", "concept": "cache", "justified": True}]})
    assert len(t.contradictions) == 0


def test_claims_conflict_helper():
    assert _claims_conflict("we want strong consistency", "go with eventual consistency")
    assert _claims_conflict("a sql database fits", "actually a nosql store is better")
    assert not _claims_conflict("redis for caching", "redis for sessions")


# ── Completion ────────────────────────────────────────────────

def test_short_interview_not_complete_at_start():
    t = _tracker()
    assert not t.is_interview_complete()
