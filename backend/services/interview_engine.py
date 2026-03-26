"""
Interview Engine — The Orchestrator
Coordinates all 4 layers: Analyzer → Tracker → Strategist → Speaker
Plus scoring via the Scorer.
"""
import json
import uuid
from pathlib import Path

from config import settings
from services.response_analyzer import response_analyzer
from services.interview_tracker import InterviewTracker
from services.interview_strategist import interview_strategist
from services.interview_speaker import interview_speaker
from services.interview_scorer import interview_scorer


# In-memory session store (production: use Redis or DB)
_sessions: dict[str, dict] = {}


def _load_knowledge_graph(problem_id: str) -> dict:
    """Load the knowledge graph for a problem."""
    path = Path(settings.content_dir) / "knowledge-graphs" / f"{problem_id}.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)

    # Fallback: minimal graph
    return {
        "problem": problem_id,
        "concepts": {},
        "concept_rubric_map": {},
    }


def _load_challenge_info(problem_id: str) -> dict:
    """Load challenge metadata."""
    path = Path(settings.content_dir) / "challenges" / f"{problem_id}.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {"title": problem_id.replace("-", " ").title(), "requirements": []}


class InterviewEngine:
    def _get_random_problem(self) -> str:
        """Pick a random problem from available challenges."""
        import random
        challenges_dir = Path(settings.content_dir) / "challenges"
        if challenges_dir.exists():
            problems = [p.stem for p in challenges_dir.glob("*.json")]
            if problems:
                return random.choice(problems)
        return "url-shortener"

    async def start_session(
        self, problem_id: str, career_level: str
    ) -> dict:
        """Start a new interview session. Returns session_id + opening message."""
        session_id = str(uuid.uuid4())[:8]

        # Normalize career level
        career_level = career_level.lower()
        if career_level not in ("sde2", "senior", "staff", "principal", "vp"):
            career_level = "senior"

        # Random problem selection
        if problem_id == "random":
            problem_id = self._get_random_problem()

        # Load knowledge graph and challenge info
        graph = _load_knowledge_graph(problem_id)
        challenge = _load_challenge_info(problem_id)

        # Create tracker
        tracker = InterviewTracker(
            knowledge_graph=graph,
            career_level=career_level,
        )

        # Generate opening message
        opening = await interview_speaker.generate_opening(
            problem_title=challenge.get("title", problem_id),
            tracker=tracker,
        )

        # Store session
        _sessions[session_id] = {
            "tracker": tracker,
            "problem_id": problem_id,
            "challenge": challenge,
            "messages": [{"role": "assistant", "content": opening}],
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

        # Record user message
        session["messages"].append({"role": "user", "content": user_message})

        # Check if interview is complete
        if tracker.is_interview_complete():
            scorecard = interview_scorer.score(tracker)
            return {
                "reply": "Thank you for walking me through your design. Let me put together your evaluation.",
                "state": tracker.to_state_dict(),
                "is_complete": True,
                "scorecard": scorecard,
            }

        # LAYER 1: Analyze the response
        analysis = await response_analyzer.analyze(user_message, session["problem_id"])

        # LAYER 2: Update tracker state
        tracker.update(analysis.to_dict())

        # LAYER 3: Decide next action
        action = interview_strategist.decide_next_action(tracker)

        # Check if action is end_interview
        if action.action_type == "end_interview":
            scorecard = interview_scorer.score(tracker)
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

        # Record assistant message
        session["messages"].append({"role": "assistant", "content": reply})

        return {
            "reply": reply,
            "state": tracker.to_state_dict(),
            "action_type": action.action_type,
            "is_complete": False,
            "scorecard": None,
        }

    def get_scorecard(self, session_id: str) -> dict | None:
        """Get the scorecard for a completed session."""
        session = _sessions.get(session_id)
        if not session:
            return None
        return interview_scorer.score(session["tracker"])

    def get_session_state(self, session_id: str) -> dict | None:
        """Get current session state."""
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
        """List available interview problems with metadata."""
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
