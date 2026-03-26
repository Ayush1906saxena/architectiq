"""
Layer 2: Interview Tracker
Maintains complete interview state — claims, coverage, contradictions, depth, rubric scores.
Pure deterministic code, zero LLM.
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

# Max minutes per phase per career level
PHASE_DURATIONS = {
    Phase.REQUIREMENTS:      {"sde2": 5, "senior": 5, "staff": 5, "principal": 7, "vp": 10},
    Phase.HIGH_LEVEL:        {"sde2": 15, "senior": 15, "staff": 15, "principal": 15, "vp": 12},
    Phase.DEEP_DIVE:         {"sde2": 8, "senior": 12, "staff": 15, "principal": 15, "vp": 15},
    Phase.SCALING_FAILURES:  {"sde2": 5, "senior": 8, "staff": 10, "principal": 10, "vp": 10},
    Phase.WRAP_UP:           {"sde2": 2, "senior": 2, "staff": 2, "principal": 3, "vp": 5},
}

# Expected depth per career level
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
    timestamp: float = 0.0


@dataclass
class Contradiction:
    old_claim: Claim
    new_claim: Claim
    exchange: int
    addressed: bool = False


class InterviewTracker:
    def __init__(self, knowledge_graph: dict, career_level: str):
        self.graph = knowledge_graph
        self.level = career_level
        self.problem_id = knowledge_graph.get("problem", "unknown")

        # Phase
        self.phase = Phase.REQUIREMENTS
        self.phase_index = 0
        self.phase_start_time = time.time()
        self.interview_start_time = time.time()

        # Exchange counter
        self.exchange_count = 0

        # Concept coverage: concept_id → Depth
        self.covered_concepts: dict[str, Depth] = {}

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

        # Deep dive target (set when transitioning to deep_dive phase)
        self.deep_dive_target: str | None = None

        # Conversation log
        self.messages: list[dict] = []

    def _base_difficulty(self) -> int:
        levels = {"sde2": 1, "senior": 2, "staff": 3, "principal": 4, "vp": 5}
        return levels.get(self.level, 2)

    def classify_depth(self, depth_signals: dict) -> Depth:
        """Classify response depth from analyzer signals."""
        score = 0
        if depth_signals.get("gave_reasoning"):         score += 1
        if depth_signals.get("used_specific_numbers"):   score += 1
        if depth_signals.get("mentioned_tradeoffs"):     score += 1
        if depth_signals.get("referenced_alternatives"): score += 1
        if depth_signals.get("discussed_failure_modes"):  score += 1

        if score == 0: return Depth.BUZZWORD
        if score == 1: return Depth.SURFACE
        if score <= 3: return Depth.APPLIED
        return Depth.DEEP

    def update(self, analysis: dict):
        """Update tracker state with new analysis from Layer 1."""
        self.exchange_count += 1
        now = time.time()

        depth = self.classify_depth(analysis.get("depth_signals", {}))

        # 1. Update concept coverage
        for concept_id in analysis.get("concepts_mentioned", []):
            current = self.covered_concepts.get(concept_id, Depth.NONE)
            self.covered_concepts[concept_id] = max(current, depth)

        # 2. Record claims
        for claim_data in analysis.get("claims", []):
            claim = Claim(
                text=claim_data.get("claim", ""),
                concept=claim_data.get("concept", ""),
                exchange=self.exchange_count,
                justified=claim_data.get("justified", False),
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
        self._adjust_difficulty(depth)

    def _check_contradictions(self):
        """Check if recent claims contradict earlier ones."""
        if len(self.claims) < 2:
            return

        recent = self.claims[-1]
        for old in self.claims[:-1]:
            if old.concept == recent.concept and old.concept:
                # Same concept, different claim — potential contradiction
                if (old.text.lower() != recent.text.lower() and
                        old.exchange != recent.exchange):
                    self.contradictions.append(Contradiction(
                        old_claim=old,
                        new_claim=recent,
                        exchange=self.exchange_count,
                    ))

    def _update_rubric(self, analysis: dict):
        """Update rubric dimension scores based on what was covered."""
        concepts = analysis.get("concepts_mentioned", [])
        depth = analysis.get("depth_signals", {})

        # Map concepts to rubric dimensions
        concept_rubric_map = self.graph.get("concept_rubric_map", {})
        for concept_id in concepts:
            dimension = concept_rubric_map.get(concept_id)
            if dimension and dimension in self.rubric_scores:
                concept_depth = self.covered_concepts.get(concept_id, Depth.BUZZWORD)
                score_add = concept_depth.value * 1.5  # 0-6 points per concept
                self.rubric_scores[dimension] = min(10, self.rubric_scores[dimension] + score_add)

        # Communication score increases with reasoning/trade-offs
        if depth.get("gave_reasoning"):
            self.rubric_scores["communication"] = min(10, self.rubric_scores["communication"] + 0.5)
        if depth.get("mentioned_tradeoffs"):
            self.rubric_scores["communication"] = min(10, self.rubric_scores["communication"] + 0.7)

    def _adjust_difficulty(self, depth: Depth):
        """Adapt interview difficulty based on answer quality."""
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

    def should_transition_phase(self) -> bool:
        """Check if we should move to the next phase."""
        if self.phase == Phase.WRAP_UP:
            return False

        elapsed_min = (time.time() - self.phase_start_time) / 60
        max_duration = PHASE_DURATIONS.get(self.phase, {}).get(self.level, 10)

        # Time exceeded
        if elapsed_min >= max_duration:
            return True

        # Minimum exchanges before transition
        min_exchanges_in_phase = 2 if self.phase == Phase.REQUIREMENTS else 3
        phase_exchanges = self.exchange_count  # Simplified — track per-phase later

        return False

    def transition_phase(self) -> str:
        """Move to next phase. Returns the new phase name."""
        self.phase_index += 1
        if self.phase_index >= len(PHASE_ORDER):
            self.phase = Phase.WRAP_UP
        else:
            self.phase = PHASE_ORDER[self.phase_index]

        self.phase_start_time = time.time()

        # If entering deep dive, pick the weakest rubric dimension
        if self.phase == Phase.DEEP_DIVE:
            self.deep_dive_target = self._find_weakest_dimension()

        return self.phase

    def _find_weakest_dimension(self) -> str:
        """Find the rubric dimension with the lowest score."""
        scorable = {k: v for k, v in self.rubric_scores.items() if k != "communication"}
        if not scorable:
            return "database_design"
        return min(scorable, key=scorable.get)

    def get_uncovered_concepts(self) -> list[str]:
        """Get concepts from the knowledge graph not yet mentioned."""
        all_concepts = set(self.graph.get("concepts", {}).keys())
        covered = set(self.covered_concepts.keys())
        return list(all_concepts - covered)

    def get_shallow_concepts(self) -> list[tuple[str, Depth]]:
        """Get concepts mentioned but at insufficient depth for the career level."""
        expected = EXPECTED_DEPTH.get(self.level, Depth.SURFACE)
        shallow = []
        for concept_id, depth in self.covered_concepts.items():
            if depth < expected:
                shallow.append((concept_id, depth))
        return shallow

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
        return (self.phase == Phase.WRAP_UP and self.get_phase_elapsed_minutes() > 1) or \
               self.get_elapsed_minutes() >= self.get_total_duration_minutes()

    def to_state_dict(self) -> dict:
        """Serialize state for API response."""
        return {
            "phase": self.phase,
            "exchange_count": self.exchange_count,
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
