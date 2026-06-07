"""
Layer 2: Interview Tracker
Maintains complete interview state — claims, coverage, contradictions, depth, rubric scores.
Pure deterministic code, zero LLM.

Key changes from v1:
- Per-concept depth from LLM (not signal counting)
- Content-driven phase transitions (not just timer-based)
- Per-phase exchange tracking
- Proper contradiction detection
- Stores candidate's actual words per concept for feedback
"""
import time
from enum import IntEnum
from dataclasses import dataclass, field


class Depth(IntEnum):
    NONE = 0
    BUZZWORD = 1    # Just named a technology
    SURFACE = 2     # Named + basic reasoning
    APPLIED = 3     # Understanding + numbers or trade-offs
    DEEP = 4        # Internals, failure modes, math, alternatives


DEPTH_FROM_STRING = {
    "none": Depth.NONE,
    "buzzword": Depth.BUZZWORD,
    "surface": Depth.SURFACE,
    "applied": Depth.APPLIED,
    "deep": Depth.DEEP,
}


class Phase(str):
    REQUIREMENTS = "requirements"
    HIGH_LEVEL = "high_level_design"
    DEEP_DIVE = "deep_dive"
    SCALING_FAILURES = "scaling_and_failures"
    WRAP_UP = "wrap_up"


PHASE_ORDER = [
    Phase.REQUIREMENTS,
    Phase.HIGH_LEVEL,
    Phase.DEEP_DIVE,
    Phase.SCALING_FAILURES,
    Phase.WRAP_UP,
]

# Hard time caps per phase (safety net — content-driven transitions should fire first)
PHASE_MAX_MINUTES = {
    Phase.REQUIREMENTS:      {"sde2": 7, "senior": 6, "staff": 5, "principal": 8, "vp": 10},
    Phase.HIGH_LEVEL:        {"sde2": 15, "senior": 15, "staff": 12, "principal": 15, "vp": 12},
    Phase.DEEP_DIVE:         {"sde2": 8, "senior": 12, "staff": 18, "principal": 15, "vp": 15},
    Phase.SCALING_FAILURES:  {"sde2": 5, "senior": 8, "staff": 10, "principal": 10, "vp": 10},
    Phase.WRAP_UP:           {"sde2": 2, "senior": 2, "staff": 2, "principal": 3, "vp": 5},
}

# Content-based transition thresholds
TRANSITION_CRITERIA = {
    Phase.REQUIREMENTS: {
        # Move to HLD when candidate has asked enough clarifying questions
        "min_exchanges": 2,
        "min_questions_asked": 1,  # At least 1 clarifying question
    },
    Phase.HIGH_LEVEL: {
        # Move to deep dive when enough high-level concepts are touched
        "min_exchanges": 3,
        "min_concepts_covered_pct": 0.35,  # 35% of concepts touched
    },
    Phase.DEEP_DIVE: {
        # Move to scaling when deep-dived enough
        "min_exchanges": 3,
        "min_deep_or_applied": 2,  # At least 2 concepts at APPLIED+ depth
    },
    Phase.SCALING_FAILURES: {
        "min_exchanges": 2,
    },
}

EXPECTED_DEPTH = {
    "sde2": Depth.SURFACE,
    "senior": Depth.APPLIED,
    "staff": Depth.DEEP,
    "principal": Depth.DEEP,
    "vp": Depth.APPLIED,  # VP focuses on strategy over tech depth
}

RUBRIC_DIMENSIONS = [
    "requirements_gathering",
    "capacity_estimation",
    "api_design",
    "database_design",
    "caching_strategy",
    "scalability",
    "failure_handling",
    "communication",
]


@dataclass
class Claim:
    text: str
    concept: str
    exchange: int
    justified: bool = False
    tested: bool = False
    reasoning: str = ""
    timestamp: float = 0.0


@dataclass
class Contradiction:
    old_claim: Claim
    new_claim: Claim
    exchange: int
    addressed: bool = False


# Mutually-exclusive design stances. A real contradiction is when a candidate
# asserts one side and later asserts the other on the same concept. This keeps the
# interviewer from "catching" contradictions that are just two different sentences
# about the same topic (the old behavior flagged any differing text).
CONFLICT_PAIRS = [
    ({"strong consistency", "strongly consistent", "linearizable", "linearizability"},
     {"eventual consistency", "eventually consistent"}),
    ({"sql", "relational", "rdbms", "acid"}, {"nosql", "non-relational"}),
    ({"synchronous", "sync ", "blocking"}, {"asynchronous", "async ", "non-blocking"}),
    ({"monolith", "monolithic"}, {"microservice", "microservices"}),
    ({"normalized", "normalize", "normalization"}, {"denormalized", "denormalize", "denormalization"}),
    ({"stateless"}, {"stateful"}),
    ({"push"}, {"pull"}),
    ({"single region", "single-region", "one region"}, {"multi region", "multi-region", "multiple regions"}),
]


def _claims_conflict(old_text: str, new_text: str) -> bool:
    """True only when the two claims take opposite sides of a known design choice."""
    a = old_text.lower()
    b = new_text.lower()
    for left, right in CONFLICT_PAIRS:
        a_left = any(t in a for t in left)
        a_right = any(t in a for t in right)
        b_left = any(t in b for t in left)
        b_right = any(t in b for t in right)
        if (a_left and b_right) or (a_right and b_left):
            return True
    return False


class InterviewTracker:
    def __init__(self, knowledge_graph: dict, career_level: str):
        self.graph = knowledge_graph
        self.level = career_level
        self.problem_id = knowledge_graph.get("problem", "unknown")

        # Phase management
        self.phase = Phase.REQUIREMENTS
        self.phase_index = 0
        self.phase_start_time = time.time()
        self.interview_start_time = time.time()

        # Per-phase exchange tracking (fixes the bug where exchange_count was global)
        self.exchange_count = 0
        self.phase_exchange_counts: dict[str, int] = {p: 0 for p in PHASE_ORDER}
        self.questions_asked_in_requirements = 0

        # Concept coverage: concept_id → Depth
        self.covered_concepts: dict[str, Depth] = {}
        # What the candidate actually said about each concept (for feedback)
        self.concept_summaries: dict[str, str] = {}

        # Rubric scores: dimension → score (0-10)
        self.rubric_scores: dict[str, float] = {d: 0.0 for d in RUBRIC_DIMENSIONS}

        # Claims tracking
        self.claims: list[Claim] = []
        self.untested_claims: list[Claim] = []
        self.contradictions: list[Contradiction] = []

        # Adaptive difficulty
        self.effective_difficulty = self._base_difficulty()
        self.consecutive_deep = 0
        self.consecutive_shallow = 0

        # Stuck tracking (was dynamically set before — now proper attribute)
        self._consecutive_stuck = 0

        # Deep dive target
        self.deep_dive_target: str | None = None

        # Suggested follow-up from analyzer (used by speaker)
        self.last_suggested_followup: str = ""
        self.last_gaps: list[str] = []

        # Conversation log for the scorer
        self.messages: list[dict] = []

    def _base_difficulty(self) -> int:
        levels = {"sde2": 1, "senior": 2, "staff": 3, "principal": 4, "vp": 5}
        return levels.get(self.level, 2)

    def update(self, analysis: dict):
        """Update tracker state with new analysis from Layer 1."""
        self.exchange_count += 1
        self.phase_exchange_counts[self.phase] = self.phase_exchange_counts.get(self.phase, 0) + 1
        now = time.time()

        # Track questions asked during requirements phase
        if self.phase == Phase.REQUIREMENTS and analysis.get("is_asking_question"):
            self.questions_asked_in_requirements += 1

        # Store LLM-provided follow-up and gaps
        self.last_suggested_followup = analysis.get("suggested_followup", "")
        self.last_gaps = analysis.get("gaps", [])

        # 1. Update concept coverage with per-concept depth from LLM
        concept_depths = analysis.get("concept_depths", {})
        concept_summaries = analysis.get("concept_summaries", {})

        for concept_id in analysis.get("concepts_mentioned", []):
            # Get LLM-assessed depth for this specific concept
            depth_str = concept_depths.get(concept_id, "surface")
            depth = DEPTH_FROM_STRING.get(depth_str, Depth.SURFACE)

            # Only upgrade, never downgrade
            current = self.covered_concepts.get(concept_id, Depth.NONE)
            self.covered_concepts[concept_id] = max(current, depth)

            # Store what they said (latest summary wins)
            summary = concept_summaries.get(concept_id, "")
            if summary:
                self.concept_summaries[concept_id] = summary

        # 2. Record claims
        for claim_data in analysis.get("claims", []):
            claim = Claim(
                text=claim_data.get("claim", ""),
                concept=claim_data.get("concept", ""),
                exchange=self.exchange_count,
                justified=claim_data.get("justified", False),
                reasoning=claim_data.get("reasoning", ""),
                timestamp=now,
            )
            self.claims.append(claim)
            if not claim.justified:
                self.untested_claims.append(claim)

        # 3. Check contradictions
        self._check_contradictions()

        # 4. Update rubric scores
        self._update_rubric(analysis)

        # 5. Adjust adaptive difficulty
        overall_depth_str = analysis.get("overall_depth", "surface")
        overall_depth = DEPTH_FROM_STRING.get(overall_depth_str, Depth.SURFACE)
        self._adjust_difficulty(overall_depth)

    def _check_contradictions(self):
        """Check if recent claims contradict earlier ones on the same concept."""
        if len(self.claims) < 2:
            return

        recent = self.claims[-1]
        if not recent.concept:
            return

        for old in self.claims[:-1]:
            if old.concept == recent.concept and old.exchange != recent.exchange:
                # Same concept, different exchange — check if claims differ
                old_lower = old.text.lower().strip()
                recent_lower = recent.text.lower().strip()

                # Skip if texts are very similar (not a contradiction)
                if old_lower == recent_lower:
                    continue

                # Skip if both are very short (likely not meaningful contradictions)
                if len(old_lower) < 10 or len(recent_lower) < 10:
                    continue

                # Only flag a genuine reversal of a design stance — not merely two
                # different sentences about the same concept.
                if not _claims_conflict(old.text, recent.text):
                    continue

                # Record as potential contradiction — the strategist decides whether to act
                self.contradictions.append(Contradiction(
                    old_claim=old,
                    new_claim=recent,
                    exchange=self.exchange_count,
                ))

    def _update_rubric(self, analysis: dict):
        """Update rubric dimension scores based on what was covered."""
        concept_rubric_map = self.graph.get("concept_rubric_map", {})
        concept_depths = analysis.get("concept_depths", {})

        for concept_id in analysis.get("concepts_mentioned", []):
            dimension = concept_rubric_map.get(concept_id)
            if dimension and dimension in self.rubric_scores:
                # Use the LLM-assessed per-concept depth, not a global signal count
                depth_str = concept_depths.get(concept_id, "surface")
                depth = DEPTH_FROM_STRING.get(depth_str, Depth.SURFACE)

                # Score contribution depends on depth:
                # BUZZWORD: +1.0, SURFACE: +2.0, APPLIED: +3.5, DEEP: +5.0
                score_map = {
                    Depth.BUZZWORD: 1.0,
                    Depth.SURFACE: 2.0,
                    Depth.APPLIED: 3.5,
                    Depth.DEEP: 5.0,
                }
                score_add = score_map.get(depth, 1.5)
                self.rubric_scores[dimension] = min(10, self.rubric_scores[dimension] + score_add)

        # Communication score based on reasoning quality
        depth_signals = analysis.get("depth_signals", {})
        if depth_signals.get("gave_reasoning"):
            self.rubric_scores["communication"] = min(10, self.rubric_scores["communication"] + 0.5)
        if depth_signals.get("mentioned_tradeoffs"):
            self.rubric_scores["communication"] = min(10, self.rubric_scores["communication"] + 0.7)
        # Asking clarifying questions in requirements shows good communication
        if analysis.get("is_asking_question") and self.phase == Phase.REQUIREMENTS:
            self.rubric_scores["communication"] = min(10, self.rubric_scores["communication"] + 1.0)

    def _adjust_difficulty(self, depth: Depth):
        if depth >= Depth.DEEP:
            self.consecutive_deep += 1
            self.consecutive_shallow = 0
            if self.consecutive_deep >= 2:
                self.effective_difficulty = min(5, self.effective_difficulty + 1)
                self.consecutive_deep = 0
        elif depth <= Depth.BUZZWORD:
            self.consecutive_shallow += 1
            self.consecutive_deep = 0
            if self.consecutive_shallow >= 2:
                self.effective_difficulty = max(1, self.effective_difficulty - 1)
                self.consecutive_shallow = 0
        else:
            self.consecutive_deep = 0
            self.consecutive_shallow = 0

    # ── Phase Transition Logic (Content-Driven) ───────────────

    def should_transition_phase(self) -> bool:
        """Check if we should move to the next phase.
        Uses content coverage as primary signal, time as safety net.
        """
        if self.phase == Phase.WRAP_UP:
            return False

        phase_exchanges = self.phase_exchange_counts.get(self.phase, 0)
        elapsed_min = (time.time() - self.phase_start_time) / 60
        max_minutes = PHASE_MAX_MINUTES.get(self.phase, {}).get(self.level, 10)
        criteria = TRANSITION_CRITERIA.get(self.phase, {})

        # Safety net: always transition if time exceeded
        if elapsed_min >= max_minutes:
            return True

        # Minimum exchanges must be met
        min_exchanges = criteria.get("min_exchanges", 2)
        if phase_exchanges < min_exchanges:
            return False

        # Content-driven criteria per phase
        if self.phase == Phase.REQUIREMENTS:
            # Transition when candidate has asked clarifying questions
            min_questions = criteria.get("min_questions_asked", 1)
            return self.questions_asked_in_requirements >= min_questions

        elif self.phase == Phase.HIGH_LEVEL:
            # Transition when enough concepts are touched
            total_concepts = len(self.graph.get("concepts", {}))
            if total_concepts == 0:
                return phase_exchanges >= 4
            covered_pct = len(self.covered_concepts) / total_concepts
            min_pct = criteria.get("min_concepts_covered_pct", 0.35)
            return covered_pct >= min_pct

        elif self.phase == Phase.DEEP_DIVE:
            # Transition when enough depth is achieved
            applied_or_deeper = sum(
                1 for d in self.covered_concepts.values() if d >= Depth.APPLIED
            )
            min_deep = criteria.get("min_deep_or_applied", 2)
            return applied_or_deeper >= min_deep

        elif self.phase == Phase.SCALING_FAILURES:
            return phase_exchanges >= criteria.get("min_exchanges", 2)

        return False

    def peek_next_phase(self) -> str:
        """Return the phase we'd move to next, without changing any state."""
        next_index = self.phase_index + 1
        if next_index >= len(PHASE_ORDER):
            return Phase.WRAP_UP
        return PHASE_ORDER[next_index]

    def transition_phase(self) -> str:
        """Move to next phase. Returns the new phase name."""
        self.phase_index += 1
        if self.phase_index >= len(PHASE_ORDER):
            self.phase = Phase.WRAP_UP
        else:
            self.phase = PHASE_ORDER[self.phase_index]

        self.phase_start_time = time.time()

        if self.phase == Phase.DEEP_DIVE:
            self.deep_dive_target = self._find_weakest_dimension()

        return self.phase

    def _find_weakest_dimension(self) -> str:
        scorable = {k: v for k, v in self.rubric_scores.items() if k != "communication"}
        if not scorable:
            return "database_design"
        return min(scorable, key=scorable.get)

    # ── Query Methods ─────────────────────────────────────────

    def get_uncovered_concepts(self) -> list[str]:
        all_concepts = set(self.graph.get("concepts", {}).keys())
        covered = set(self.covered_concepts.keys())
        return list(all_concepts - covered)

    def get_shallow_concepts(self) -> list[tuple[str, Depth]]:
        expected = EXPECTED_DEPTH.get(self.level, Depth.SURFACE)
        return [
            (cid, depth) for cid, depth in self.covered_concepts.items()
            if depth < expected
        ]

    def get_unaddressed_contradictions(self) -> list[Contradiction]:
        return [c for c in self.contradictions if not c.addressed]

    def get_elapsed_minutes(self) -> float:
        return (time.time() - self.interview_start_time) / 60

    def get_phase_elapsed_minutes(self) -> float:
        return (time.time() - self.phase_start_time) / 60

    def get_total_duration_minutes(self) -> int:
        durations = {"sde2": 30, "senior": 40, "staff": 45, "principal": 50, "vp": 55}
        return durations.get(self.level, 45)

    def is_interview_complete(self) -> bool:
        return (
            (self.phase == Phase.WRAP_UP and self.get_phase_elapsed_minutes() > 1) or
            self.get_elapsed_minutes() >= self.get_total_duration_minutes()
        )

    def to_state_dict(self) -> dict:
        return {
            "phase": self.phase,
            "exchange_count": self.exchange_count,
            "phase_exchanges": self.phase_exchange_counts.get(self.phase, 0),
            "elapsed_minutes": round(self.get_elapsed_minutes(), 1),
            "total_minutes": self.get_total_duration_minutes(),
            "effective_difficulty": self.effective_difficulty,
            "level": self.level,
            "concepts_covered": len(self.covered_concepts),
            "concepts_total": len(self.graph.get("concepts", {})),
            "rubric_scores": {k: round(v, 1) for k, v in self.rubric_scores.items()},
            "deep_dive_target": self.deep_dive_target,
            "contradictions_found": len(self.contradictions),
        }
