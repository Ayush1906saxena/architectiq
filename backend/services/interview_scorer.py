"""
Interview Scorer
Deterministic rubric-based scoring. Zero LLM. Fully reproducible.
"""
from services.interview_tracker import InterviewTracker, Depth, EXPECTED_DEPTH

RUBRIC_WEIGHTS = {
    "requirements_gathering": 10,
    "capacity_estimation": 12,
    "api_design": 10,
    "database_design": 15,
    "caching_strategy": 10,
    "scalability": 18,
    "failure_handling": 15,
    "communication": 10,
}

# Level-specific pass thresholds
PASS_THRESHOLDS = {
    "sde2": 55,
    "senior": 65,
    "staff": 75,
    "principal": 80,
    "vp": 85,
}

LEVEL_NAMES = {
    "sde2": "SDE2 / Mid-Level",
    "senior": "Senior Engineer",
    "staff": "Staff Engineer",
    "principal": "Principal Engineer",
    "vp": "VP / Architect",
}

BADGE_THRESHOLDS = [
    (95, "legendary", "Legendary"),
    (85, "diamond", "Diamond"),
    (75, "gold", "Gold"),
    (65, "silver", "Silver"),
    (50, "bronze", "Bronze"),
]


class InterviewScorer:
    def score(self, tracker: InterviewTracker) -> dict:
        """Generate full scorecard from interview state."""

        # Normalize rubric scores to 0-10
        dimension_scores = {}
        for dim, raw_score in tracker.rubric_scores.items():
            dimension_scores[dim] = min(10, round(raw_score, 1))

        # Calculate weighted overall score
        total_weight = sum(RUBRIC_WEIGHTS.values())
        weighted_sum = sum(
            dimension_scores.get(dim, 0) * weight
            for dim, weight in RUBRIC_WEIGHTS.items()
        )
        overall = round((weighted_sum / total_weight) * 10)  # Scale to 0-100

        # Determine badge
        badge = "none"
        badge_label = ""
        for threshold, badge_id, label in BADGE_THRESHOLDS:
            if overall >= threshold:
                badge = badge_id
                badge_label = label
                break

        # Pass/fail
        threshold = PASS_THRESHOLDS.get(tracker.level, 65)
        passed = overall >= threshold

        # Level assessment
        assessed_level = self._assess_effective_level(overall, dimension_scores)

        # Strengths and weaknesses
        strengths = self._identify_strengths(dimension_scores, tracker)
        weaknesses = self._identify_weaknesses(dimension_scores, tracker)

        # Recommended lessons
        recommendations = self._recommend_lessons(dimension_scores, tracker)

        # Depth analysis
        depth_summary = self._depth_summary(tracker)

        return {
            "overall_score": overall,
            "passed": passed,
            "pass_threshold": threshold,
            "badge": badge,
            "badge_label": badge_label,
            "level_attempted": LEVEL_NAMES.get(tracker.level, tracker.level),
            "level_assessed": assessed_level,
            "dimension_scores": dimension_scores,
            "dimension_weights": RUBRIC_WEIGHTS,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "recommendations": recommendations,
            "depth_summary": depth_summary,
            "stats": {
                "exchanges": tracker.exchange_count,
                "concepts_covered": len(tracker.covered_concepts),
                "concepts_total": len(tracker.graph.get("concepts", {})),
                "contradictions_caught": len(tracker.contradictions),
                "duration_minutes": round(tracker.get_elapsed_minutes(), 1),
                "effective_difficulty_reached": tracker.effective_difficulty,
            },
        }

    def _assess_effective_level(self, overall: int, dimension_scores: dict) -> str:
        """Determine what level the candidate actually performed at."""
        if overall >= 85:
            return "VP / Architect level"
        elif overall >= 75:
            return "Staff Engineer level"
        elif overall >= 65:
            return "Senior Engineer level"
        elif overall >= 55:
            return "Mid-Level (SDE2) level"
        else:
            return "Below mid-level — needs more preparation"

    def _identify_strengths(self, scores: dict, tracker: InterviewTracker) -> list[str]:
        """Identify top strengths with specific feedback."""
        strengths = []
        sorted_dims = sorted(scores.items(), key=lambda x: x[1], reverse=True)

        for dim, score in sorted_dims[:3]:
            if score >= 7:
                strengths.append(self._strength_message(dim, score, tracker))

        # Bonus strengths from behavior
        if tracker.covered_concepts:
            deep_count = sum(1 for d in tracker.covered_concepts.values() if d >= Depth.DEEP)
            if deep_count >= 3:
                strengths.append(
                    f"Demonstrated deep understanding in {deep_count} areas — "
                    "showed you don't just know the buzzwords."
                )

        if len(tracker.claims) > 0:
            justified = sum(1 for c in tracker.claims if c.justified)
            if justified / len(tracker.claims) > 0.6:
                strengths.append(
                    "Consistently justified your decisions with reasoning — "
                    "this is what separates senior engineers from juniors."
                )

        return strengths[:4]

    def _identify_weaknesses(self, scores: dict, tracker: InterviewTracker) -> list[str]:
        """Identify weaknesses with actionable feedback."""
        weaknesses = []
        sorted_dims = sorted(scores.items(), key=lambda x: x[1])

        for dim, score in sorted_dims[:3]:
            if score < 5:
                weaknesses.append(self._weakness_message(dim, score, tracker))

        # Behavioral weaknesses
        shallow = tracker.get_shallow_concepts()
        if len(shallow) > 3:
            names = [tracker.graph.get("concepts", {}).get(c, {}).get("name", c) for c, _ in shallow[:3]]
            weaknesses.append(
                f"You mentioned {', '.join(names)} but stayed surface-level. "
                "When you name a technology, always explain WHY you chose it and what the trade-off is."
            )

        if not any(s.get("discussed_failure_modes") for s in [{}]):
            uncovered = tracker.get_uncovered_concepts()
            if len(uncovered) > len(tracker.covered_concepts):
                weaknesses.append(
                    "You left several important areas undiscussed. "
                    "In a real interview, try to cover breadth first, then go deep where asked."
                )

        return weaknesses[:4]

    def _strength_message(self, dim: str, score: float, tracker: InterviewTracker) -> str:
        messages = {
            "requirements_gathering": f"Strong requirements gathering (score: {score}/10) — you asked the right clarifying questions before diving in.",
            "capacity_estimation": f"Solid capacity estimation ({score}/10) — you showed you can think in numbers, not just concepts.",
            "api_design": f"Clean API design ({score}/10) — your endpoints were well-structured and RESTful.",
            "database_design": f"Thoughtful database design ({score}/10) — you justified your choice and considered the access patterns.",
            "caching_strategy": f"Good caching strategy ({score}/10) — you identified where caching helps most and discussed invalidation.",
            "scalability": f"Strong scalability thinking ({score}/10) — you anticipated growth and designed for it.",
            "failure_handling": f"Excellent failure handling ({score}/10) — you thought about what breaks, not just what works.",
            "communication": f"Clear communication ({score}/10) — you structured your thoughts well and drove the conversation.",
        }
        return messages.get(dim, f"Strong {dim.replace('_', ' ')} ({score}/10).")

    def _weakness_message(self, dim: str, score: float, tracker: InterviewTracker) -> str:
        messages = {
            "requirements_gathering": f"Weak requirements gathering ({score}/10). Always start by asking about scale, users, and constraints before designing.",
            "capacity_estimation": f"Missing capacity estimation ({score}/10). Practice: users → QPS → storage → bandwidth → cache size. Use real numbers.",
            "api_design": f"API design needs work ({score}/10). Define your endpoints explicitly — method, path, request/response body.",
            "database_design": f"Database design was shallow ({score}/10). Don't just name a database — explain your schema, indexes, and why this DB fits the access pattern.",
            "caching_strategy": f"Caching not addressed well ({score}/10). For read-heavy systems, always discuss where to cache, eviction policy, and invalidation strategy.",
            "scalability": f"Scalability gaps ({score}/10). Ask yourself: 'What happens at 10x traffic?' for every component.",
            "failure_handling": f"Failure handling is your weakest area ({score}/10). For every component you add, ask 'What happens when THIS fails?'",
            "communication": f"Communication could improve ({score}/10). Structure your answer: requirements → estimation → high-level → deep dive → trade-offs.",
        }
        return messages.get(dim, f"Needs improvement: {dim.replace('_', ' ')} ({score}/10).")

    def _recommend_lessons(self, scores: dict, tracker: InterviewTracker) -> list[dict]:
        """Recommend specific ArchitectIQ lessons based on weak areas."""
        LESSON_MAP = {
            "requirements_gathering": [
                {"topic": "web", "lesson": "L2", "title": "REST API Design"},
            ],
            "capacity_estimation": [
                {"topic": "url-shortener", "lesson": "L1-intro", "title": "URL Shortener — Capacity Estimation"},
            ],
            "database_design": [
                {"topic": "databases", "lesson": "L1-intro", "title": "Why Databases Exist"},
                {"topic": "databases", "lesson": "L5", "title": "SQL vs NoSQL Decision Framework"},
            ],
            "caching_strategy": [
                {"topic": "caching", "lesson": "L1-intro", "title": "Why Caching Works"},
                {"topic": "caching", "lesson": "L4", "title": "Cache Invalidation"},
            ],
            "scalability": [
                {"topic": "load-balancing", "lesson": "L1-intro", "title": "Load Balancing"},
                {"topic": "partitioning", "lesson": "L1-intro", "title": "Data Partitioning"},
                {"topic": "consistent-hashing", "lesson": "L1-intro", "title": "Consistent Hashing"},
            ],
            "failure_handling": [
                {"topic": "replication", "lesson": "L1-intro", "title": "Data Replication"},
                {"topic": "cap-theorem", "lesson": "L1-intro", "title": "CAP Theorem"},
                {"topic": "consensus", "lesson": "L1-intro", "title": "Consensus & Coordination"},
            ],
        }

        recs = []
        sorted_dims = sorted(scores.items(), key=lambda x: x[1])
        for dim, score in sorted_dims[:3]:
            if score < 6 and dim in LESSON_MAP:
                for lesson in LESSON_MAP[dim]:
                    recs.append({
                        "reason": f"Your {dim.replace('_', ' ')} scored {score}/10",
                        **lesson,
                    })
        return recs[:5]

    def _depth_summary(self, tracker: InterviewTracker) -> dict:
        """Summarize concept depth across the interview."""
        depth_counts = {d.name: 0 for d in Depth}
        for depth in tracker.covered_concepts.values():
            depth_counts[depth.name] += 1

        return {
            "total_concepts_mentioned": len(tracker.covered_concepts),
            "depth_distribution": depth_counts,
            "average_depth": round(
                sum(d.value for d in tracker.covered_concepts.values()) /
                max(len(tracker.covered_concepts), 1), 1
            ),
        }


interview_scorer = InterviewScorer()
