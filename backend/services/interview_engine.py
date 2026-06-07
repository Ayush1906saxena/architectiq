"""
Interview Engine — The Orchestrator
Coordinates all 4 layers: Analyzer → Tracker → Strategist → Speaker
Plus scoring via the Scorer.
"""
import json
import secrets
import time
from pathlib import Path

from config import settings
from services.response_analyzer import response_analyzer
from services.interview_tracker import InterviewTracker
from services.interview_strategist import interview_strategist
from services.interview_speaker import interview_speaker
from services.interview_scorer import interview_scorer
from middleware.security import sanitize_for_prompt, sanitize_path_component


# ── Session Store with TTL and Limits ─────────────────────────

MAX_SESSIONS = 500                    # max concurrent sessions
SESSION_TTL_SECONDS = 60 * 60         # 1 hour
MAX_MESSAGES_PER_SESSION = 60         # max exchanges before forced end
MAX_MESSAGE_LENGTH = 5000             # max chars per user message

_sessions: dict[str, dict] = {}


def _cleanup_stale_sessions():
    """Remove sessions older than TTL. Called periodically."""
    now = time.monotonic()
    stale = [
        sid for sid, s in _sessions.items()
        if now - s.get("created_at", 0) > SESSION_TTL_SECONDS
    ]
    for sid in stale:
        _sessions.pop(sid, None)


def _load_knowledge_graph(problem_id: str) -> dict:
    """Load the knowledge graph for a problem."""
    safe_id = sanitize_path_component(problem_id)
    path = Path(settings.content_dir) / "knowledge-graphs" / f"{safe_id}.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {"problem": safe_id, "concepts": {}, "concept_rubric_map": {}}


def _load_challenge_info(problem_id: str) -> dict:
    """Load challenge metadata."""
    safe_id = sanitize_path_component(problem_id)
    path = Path(settings.content_dir) / "challenges" / f"{safe_id}.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {"title": safe_id.replace("-", " ").title(), "requirements": []}


# ── Valid problem IDs (whitelist) ─────────────────────────────

def _get_valid_problem_ids() -> set[str]:
    challenges_dir = Path(settings.content_dir) / "challenges"
    if challenges_dir.exists():
        return {p.stem for p in challenges_dir.glob("*.json")}
    return set()


class InterviewEngine:
    def _get_random_problem(self) -> str:
        import random
        valid = _get_valid_problem_ids()
        return random.choice(list(valid)) if valid else "url-shortener"

    async def start_session(self, problem_id: str, career_level: str) -> dict:
        """Start a new interview session."""
        # Cleanup stale sessions first
        _cleanup_stale_sessions()

        # Enforce session limit
        if len(_sessions) >= MAX_SESSIONS:
            raise ValueError("Server is at capacity. Please try again later.")

        # Cryptographically secure session ID (32 hex chars = 128 bits)
        session_id = secrets.token_hex(16)

        # Validate career level
        career_level = career_level.lower().strip()
        if career_level not in ("sde2", "senior", "staff", "principal", "vp"):
            career_level = "senior"

        # Validate problem ID against whitelist
        if problem_id == "random":
            problem_id = self._get_random_problem()
        else:
            valid_ids = _get_valid_problem_ids()
            safe_id = sanitize_path_component(problem_id)
            if safe_id not in valid_ids:
                raise ValueError(f"Unknown problem: {problem_id}")
            problem_id = safe_id

        graph = _load_knowledge_graph(problem_id)
        challenge = _load_challenge_info(problem_id)

        tracker = InterviewTracker(
            knowledge_graph=graph,
            career_level=career_level,
        )

        opening = await interview_speaker.generate_opening(
            problem_title=challenge.get("title", problem_id),
            tracker=tracker,
        )

        # The tracker shares the same transcript list the engine appends to, so the
        # scorer (which reads tracker.messages) sees the full conversation. Without
        # this the LLM-judged scorecard never ran — tracker.messages stayed empty
        # and the scorer always fell back to the deterministic rubric.
        messages = [{"role": "assistant", "content": opening}]
        tracker.messages = messages

        _sessions[session_id] = {
            "tracker": tracker,
            "problem_id": problem_id,
            "challenge": challenge,
            "messages": messages,
            "created_at": time.monotonic(),
        }

        return {
            "session_id": session_id,
            "opening_message": opening,
            "problem_id": problem_id,
            "problem_title": challenge.get("title", problem_id.replace("-", " ").title()),
            "state": tracker.to_state_dict(),
        }

    async def process_message(self, session_id: str, user_message: str) -> dict:
        """Process a candidate message and generate interviewer response."""
        session = _sessions.get(session_id)
        if not session:
            return {"error": "Session not found", "reply": "Session expired. Please start a new interview."}

        tracker: InterviewTracker = session["tracker"]

        # Enforce message length
        user_message = user_message[:MAX_MESSAGE_LENGTH]

        # Enforce max messages per session
        if len(session["messages"]) >= MAX_MESSAGES_PER_SESSION:
            scorecard = await interview_scorer.score(tracker)
            return {
                "reply": "We've reached the end of our time. Let me put together your evaluation.",
                "state": tracker.to_state_dict(),
                "is_complete": True,
                "scorecard": scorecard,
            }

        # Sanitize for prompt injection before any LLM processing
        sanitized_message = sanitize_for_prompt(user_message)

        # Record user message (store original for display, use sanitized for LLM)
        session["messages"].append({"role": "user", "content": user_message})

        # Check if interview is complete
        if tracker.is_interview_complete():
            scorecard = await interview_scorer.score(tracker)
            return {
                "reply": "Thank you for walking me through your design. Let me put together your evaluation.",
                "state": tracker.to_state_dict(),
                "is_complete": True,
                "scorecard": scorecard,
            }

        # LAYER 1: Analyze the response (uses sanitized input)
        analysis = await response_analyzer.analyze(sanitized_message, session["problem_id"])
        analysis_dict = analysis.to_dict()

        # LAYER 2: Update tracker state
        tracker.update(analysis_dict)

        # LAYER 3: Decide next action
        action = interview_strategist.decide_next_action(tracker, analysis_dict)

        # Check if action is end_interview
        if action.action_type == "end_interview":
            scorecard = await interview_scorer.score(tracker)
            reply = action.data.get("message", "That's all the time we have. Thank you.")
            session["messages"].append({"role": "assistant", "content": reply})
            return {
                "reply": reply,
                "state": tracker.to_state_dict(),
                "is_complete": True,
                "scorecard": scorecard,
            }

        # LAYER 4: Generate natural language response
        reply = await interview_speaker.generate_response(action, tracker)

        session["messages"].append({"role": "assistant", "content": reply})

        return {
            "reply": reply,
            "state": tracker.to_state_dict(),
            "action_type": action.action_type,
            "is_complete": False,
            "scorecard": None,
        }

    async def get_scorecard(self, session_id: str) -> dict | None:
        session = _sessions.get(session_id)
        if not session:
            return None
        return await interview_scorer.score(session["tracker"])

    def get_transcript(self, session_id: str) -> list[dict] | None:
        """Return the full message transcript for a session."""
        session = _sessions.get(session_id)
        if not session:
            return None
        return list(session["messages"])

    def get_session_state(self, session_id: str) -> dict | None:
        session = _sessions.get(session_id)
        if not session:
            return None
        tracker: InterviewTracker = session["tracker"]
        return {
            "state": tracker.to_state_dict(),
            "messages": session["messages"],
            "is_complete": tracker.is_interview_complete(),
        }

    def list_problems(self) -> list[dict]:
        challenges_dir = Path(settings.content_dir) / "challenges"
        problems = []
        if challenges_dir.exists():
            for path in sorted(challenges_dir.glob("*.json")):
                with open(path) as f:
                    data = json.load(f)
                problems.append({
                    "id": path.stem,
                    "title": data.get("title", path.stem),
                    "description": data.get("description", ""),
                })
        return problems


interview_engine = InterviewEngine()
