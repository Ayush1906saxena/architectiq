"""Tests for the strategist — especially that side effects apply ONLY to the winner."""
import pytest

from services.interview_tracker import InterviewTracker, Phase, Claim, Contradiction
from services.interview_strategist import interview_strategist


def _graph():
    return {
        "problem": "test",
        "concepts": {"db": {"name": "Database", "category": "storage"}},
        "concept_rubric_map": {"db": "database_design"},
    }


def _tracker():
    return InterviewTracker(knowledge_graph=_graph(), career_level="senior")


def _with_pending_contradiction(t):
    old = Claim(text="I'll use eventual consistency everywhere", concept="db", exchange=1)
    new = Claim(text="We actually need strong consistency", concept="db", exchange=2)
    t.claims = [old, new]
    t.contradictions = [Contradiction(old_claim=old, new_claim=new, exchange=2)]


def test_stuck_answer_yields_hint():
    t = _tracker()
    action = interview_strategist.decide_next_action(t, {"is_stuck": True})
    assert action.action_type in ("give_hint", "give_strong_hint")
    assert action.priority == 110
    assert t._consecutive_stuck == 1


def test_contradiction_wins_and_does_not_advance_phase():
    """The core regression: a pending phase transition must NOT fire its side
    effect when a higher-priority contradiction is the action actually returned."""
    t = _tracker()
    _with_pending_contradiction(t)
    t.should_transition_phase = lambda: True  # force a competing transition candidate

    action = interview_strategist.decide_next_action(t, {"concepts_mentioned": ["db"]})

    assert action.action_type == "catch_contradiction"
    # Phase must be untouched — this was the bug.
    assert t.phase == Phase.REQUIREMENTS
    assert t.phase_index == 0
    # The winning contradiction is marked addressed.
    assert t.contradictions[0].addressed is True


def test_transition_wins_and_advances_phase():
    t = _tracker()
    t.should_transition_phase = lambda: True

    action = interview_strategist.decide_next_action(t, {"concepts_mentioned": ["db"]})

    assert action.action_type == "transition_phase"
    assert action.data["to_phase"] == Phase.HIGH_LEVEL
    assert t.phase == Phase.HIGH_LEVEL  # side effect applied for the winner
    assert t.phase_index == 1


def test_losing_followup_is_not_consumed():
    t = _tracker()
    _with_pending_contradiction(t)
    t.last_suggested_followup = "Can you walk me through how writes are replicated here?"

    action = interview_strategist.decide_next_action(t, {"concepts_mentioned": ["db"]})

    assert action.action_type == "catch_contradiction"
    # Follow-up outranked by the contradiction must remain for a later turn.
    assert t.last_suggested_followup != ""


def test_winning_followup_is_consumed():
    t = _tracker()
    t.last_suggested_followup = "Can you walk me through how writes are replicated here?"

    action = interview_strategist.decide_next_action(t, {"concepts_mentioned": ["db"]})

    assert action.action_type == "llm_followup"
    assert t.last_suggested_followup == ""


def test_losing_probe_does_not_consume_claim():
    t = _tracker()
    _with_pending_contradiction(t)
    claim = Claim(text="I'd shard the database by user_id", concept="db", exchange=2)
    t.untested_claims = [claim]

    action = interview_strategist.decide_next_action(t, {"concepts_mentioned": ["db"]})

    assert action.action_type == "catch_contradiction"
    # The untested claim must survive for a future probe.
    assert claim in t.untested_claims
    assert claim.tested is False
