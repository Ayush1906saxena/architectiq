"""Engine-level tests with the LLM layers mocked out."""
import pytest

from services import interview_engine as eng_mod
from services.interview_engine import interview_engine
from services.response_analyzer import ResponseAnalysis


@pytest.fixture
def mock_llm(monkeypatch):
    async def fake_opening(problem_title, tracker):
        return "Welcome. What questions do you have about the requirements?"

    async def fake_analyze(text, problem_id=""):
        r = ResponseAnalysis()
        r.concepts_mentioned = ["db"]
        r.concept_depths = {"db": "applied"}
        return r

    async def fake_response(action, tracker):
        return "Interviewer reply."

    monkeypatch.setattr(eng_mod.interview_speaker, "generate_opening", fake_opening)
    monkeypatch.setattr(eng_mod.response_analyzer, "analyze", fake_analyze)
    monkeypatch.setattr(eng_mod.interview_speaker, "generate_response", fake_response)


async def test_tracker_messages_track_full_transcript(mock_llm):
    """Regression: the scorer reads tracker.messages, which must reflect the
    conversation. Previously tracker.messages stayed empty and the LLM scorer
    never ran."""
    started = await interview_engine.start_session("url-shortener", "senior")
    sid = started["session_id"]

    session = eng_mod._sessions[sid]
    tracker = session["tracker"]

    # Tracker shares the engine's transcript list and already has the opening.
    assert tracker.messages is session["messages"]
    assert len(tracker.messages) == 1

    await interview_engine.process_message(sid, "I'd shard the database by short_code in DynamoDB.")

    # The candidate's words and the interviewer's reply are now visible to the scorer.
    assert len(tracker.messages) >= 2
    assert any(m["role"] == "user" for m in tracker.messages)
    assert tracker.messages  # truthy — the scorer's guard would now pass
