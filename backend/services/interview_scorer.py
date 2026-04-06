"""
Interview Scorer
Hybrid scoring: LLM-judged evaluation (primary) with deterministic rubric (fallback/validation).

The LLM reads the full conversation and scores each dimension with specific justification
referencing the candidate's actual words. The deterministic scorer provides a baseline
and catches cases where the LLM might be too generous or too harsh.
"""
import json

from services.interview_tracker import InterviewTracker, Depth, EXPECTED_DEPTH
from services.ollama_client import ollama_client

RUBRIC_WEIGHTS = {
    "requirements_gathering": 10,
    "capacity_estimation": 12,
    "api_design": 10,
    "database_design": 15,
    "caching_strategy": 10,
    "scalability": 15,
    "failure_handling": 15,
    "communication": 13,
}

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

_SCORER_SYSTEM = """You are an expert system design interview evaluator. You've evaluated thousands of candidates at top tech companies.

Score this interview conversation on 8 dimensions (0-10 each). For each dimension, provide:
1. A numeric score
2. A 1-2 sentence justification that QUOTES or REFERENCES the candidate's actual words

Scoring guidelines:
- 0-2: Not addressed or completely wrong
- 3-4: Mentioned but shallow, no reasoning
- 5-6: Decent understanding, some gaps
- 7-8: Strong with good reasoning and trade-offs
- 9-10: Exceptional depth, production-grade thinking

Be strict. A score of 7+ should be genuinely impressive, not just "they mentioned the right keywords."
A candidate who name-drops technologies without explaining WHY should score 3-4 on that dimension, not 6-7.

Respond with ONLY valid JSON. No markdown, no code fences."""


class InterviewScorer:
    async def score(self, tracker: InterviewTracker) -> dict:
        """Generate full scorecard. Uses LLM for evaluation, deterministic as fallback."""

        # Try LLM-judged scoring
        llm_scores = await self._llm_score(tracker)

        if llm_scores:
            dimension_scores = llm_scores.get("dimensions", {})
            strengths = llm_scores.get("strengths", [])
            weaknesses = llm_scores.get("weaknesses", [])
        else:
            # Fallback to deterministic scoring
            dimension_scores = self._deterministic_scores(tracker)
            strengths = self._identify_strengths(dimension_scores, tracker)
            weaknesses = self._identify_weaknesses(dimension_scores, tracker)

        # Ensure all dimensions present with valid scores
        for dim in RUBRIC_WEIGHTS:
            if dim not in dimension_scores:
                dimension_scores[dim] = round(tracker.rubric_scores.get(dim, 0), 1)
            dimension_scores[dim] = max(0, min(10, round(float(dimension_scores[dim]), 1)))

        # Calculate weighted overall score
        total_weight = sum(RUBRIC_WEIGHTS.values())
        weighted_sum = sum(
            dimension_scores.get(dim, 0) * weight
            for dim, weight in RUBRIC_WEIGHTS.items()
        )
        overall = round((weighted_sum / total_weight) * 10)
        overall = max(0, min(100, overall))

        # Badge
        badge, badge_label = "none", ""
        for threshold, bid, label in BADGE_THRESHOLDS:
            if overall >= threshold:
                badge, badge_label = bid, label
                break

        # Pass/fail
        threshold = PASS_THRESHOLDS.get(tracker.level, 65)
        passed = overall >= threshold

        # Depth summary with per-concept detail
        depth_summary = self._depth_summary(tracker)

        # Recommendations
        recommendations = self._recommend_lessons(dimension_scores, tracker)

        return {
            "overall_score": overall,
            "passed": passed,
            "pass_threshold": threshold,
            "badge": badge,
            "badge_label": badge_label,
            "level_attempted": LEVEL_NAMES.get(tracker.level, tracker.level),
            "level_assessed": self._assess_effective_level(overall),
            "dimension_scores": dimension_scores,
            "dimension_weights": RUBRIC_WEIGHTS,
            "strengths": strengths[:4],
            "weaknesses": weaknesses[:4],
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

    async def _llm_score(self, tracker: InterviewTracker) -> dict | None:
        """Use LLM to evaluate the full interview conversation."""
        if not tracker.messages:
            return None

        # Build conversation transcript
        transcript_lines = []
        for msg in tracker.messages[-40:]:  # Last 40 messages max to fit context
            role = "INTERVIEWER" if msg.get("role") == "assistant" else "CANDIDATE"
            transcript_lines.append(f"{role}: {msg['content']}")
        transcript = "\n\n".join(transcript_lines)

        # Build concept coverage summary
        coverage_lines = []
        graph_concepts = tracker.graph.get("concepts", {})
        for cid, depth in tracker.covered_concepts.items():
            name = graph_concepts.get(cid, {}).get("name", cid)
            summary = tracker.concept_summaries.get(cid, "")
            coverage_lines.append(f"- {name}: {depth.name} depth. {summary}")
        coverage = "\n".join(coverage_lines) if coverage_lines else "No concepts covered."

        prompt = f"""Score this {LEVEL_NAMES.get(tracker.level, 'Senior')} system design interview.

PROBLEM: {tracker.problem_id}
CAREER LEVEL: {tracker.level}

CONVERSATION TRANSCRIPT:
{transcript}

CONCEPT COVERAGE (from automated tracking):
{coverage}

Score each dimension 0-10 with a justification that references what the candidate actually said.
Also provide 2-3 strengths and 2-3 weaknesses, each referencing specific moments in the interview.

Respond with this JSON:
{{
  "dimensions": {{
    "requirements_gathering": {{"score": N, "reason": "..."}},
    "capacity_estimation": {{"score": N, "reason": "..."}},
    "api_design": {{"score": N, "reason": "..."}},
    "database_design": {{"score": N, "reason": "..."}},
    "caching_strategy": {{"score": N, "reason": "..."}},
    "scalability": {{"score": N, "reason": "..."}},
    "failure_handling": {{"score": N, "reason": "..."}},
    "communication": {{"score": N, "reason": "..."}}
  }},
  "strengths": [
    "Specific strength referencing what they said..."
  ],
  "weaknesses": [
    "Specific weakness referencing what they said or failed to say..."
  ]
}}"""

        try:
            raw = await ollama_client.generate(
                prompt,
                system=_SCORER_SYSTEM,
                json_mode=True,
                temperature=0.2,
                max_tokens=2048,
            )
            parsed = json.loads(raw)

            # Validate structure
            dims = parsed.get("dimensions", {})
            if not isinstance(dims, dict):
                return None

            # Extract scores and reasons
            result_dims = {}
            for dim_name, dim_data in dims.items():
                if isinstance(dim_data, dict):
                    result_dims[dim_name] = dim_data.get("score", 5)
                elif isinstance(dim_data, (int, float)):
                    result_dims[dim_name] = dim_data

            return {
                "dimensions": result_dims,
                "strengths": parsed.get("strengths", []),
                "weaknesses": parsed.get("weaknesses", []),
            }

        except (json.JSONDecodeError, TypeError, KeyError):
            return None

    def _deterministic_scores(self, tracker: InterviewTracker) -> dict:
        """Fallback deterministic scoring from tracker rubric scores."""
        return {dim: min(10, round(score, 1)) for dim, score in tracker.rubric_scores.items()}

    def _identify_strengths(self, scores: dict, tracker: InterviewTracker) -> list[str]:
        strengths = []
        sorted_dims = sorted(scores.items(), key=lambda x: x[1], reverse=True)

        for dim, score in sorted_dims[:3]:
            if score >= 7:
                strengths.append(self._strength_message(dim, score, tracker))

        if tracker.covered_concepts:
            deep_count = sum(1 for d in tracker.covered_concepts.values() if d >= Depth.DEEP)
            if deep_count >= 3:
                concepts = [
                    tracker.graph.get("concepts", {}).get(cid, {}).get("name", cid)
                    for cid, d in tracker.covered_concepts.items() if d >= Depth.DEEP
                ]
                strengths.append(
                    f"Demonstrated deep understanding in {', '.join(concepts[:3])}."
                )

        return strengths[:4]

    def _identify_weaknesses(self, scores: dict, tracker: InterviewTracker) -> list[str]:
        weaknesses = []
        sorted_dims = sorted(scores.items(), key=lambda x: x[1])

        for dim, score in sorted_dims[:3]:
            if score < 5:
                weaknesses.append(self._weakness_message(dim, score, tracker))

        # Reference specific shallow concepts
        shallow = tracker.get_shallow_concepts()
        if len(shallow) > 2:
            examples = []
            for cid, depth in shallow[:3]:
                name = tracker.graph.get("concepts", {}).get(cid, {}).get("name", cid)
                summary = tracker.concept_summaries.get(cid, "")
                if summary:
                    examples.append(f"{name} (you said: \"{summary[:80]}...\" but didn't go deeper)")
                else:
                    examples.append(f"{name} (mentioned but not explained)")
            weaknesses.append(
                f"Stayed surface-level on: {'; '.join(examples)}. "
                "When you name a technology, explain WHY and what the trade-off is."
            )

        return weaknesses[:4]

    def _strength_message(self, dim: str, score: float, tracker: InterviewTracker) -> str:
        messages = {
            "requirements_gathering": f"Strong requirements gathering ({score}/10) — asked the right clarifying questions before designing.",
            "capacity_estimation": f"Solid capacity estimation ({score}/10) — did the math and let it inform design decisions.",
            "api_design": f"Clean API design ({score}/10) — well-structured endpoints with clear contracts.",
            "database_design": f"Thoughtful database design ({score}/10) — justified the choice and considered access patterns.",
            "caching_strategy": f"Good caching strategy ({score}/10) — identified where caching helps most and discussed invalidation.",
            "scalability": f"Strong scalability thinking ({score}/10) — anticipated growth and designed for it.",
            "failure_handling": f"Excellent failure handling ({score}/10) — thought about what breaks, not just what works.",
            "communication": f"Clear communication ({score}/10) — structured thoughts well and drove the conversation.",
        }
        return messages.get(dim, f"Strong {dim.replace('_', ' ')} ({score}/10).")

    def _weakness_message(self, dim: str, score: float, tracker: InterviewTracker) -> str:
        messages = {
            "requirements_gathering": f"Weak requirements gathering ({score}/10). Start by asking about scale, users, and constraints before designing.",
            "capacity_estimation": f"Missing capacity estimation ({score}/10). Practice: users → QPS → storage → bandwidth → cache size.",
            "api_design": f"API design needs work ({score}/10). Define endpoints explicitly — method, path, request/response body.",
            "database_design": f"Database design was shallow ({score}/10). Don't just name a database — explain schema, indexes, and why this DB fits.",
            "caching_strategy": f"Caching not addressed ({score}/10). For read-heavy systems, discuss where to cache, eviction policy, and invalidation.",
            "scalability": f"Scalability gaps ({score}/10). For every component, ask: 'What happens at 10x traffic?'",
            "failure_handling": f"Failure handling is weak ({score}/10). For every component, ask: 'What happens when this fails?'",
            "communication": f"Communication needs improvement ({score}/10). Structure: requirements → estimation → high-level → deep dive → trade-offs.",
        }
        return messages.get(dim, f"Needs improvement: {dim.replace('_', ' ')} ({score}/10).")

    def _assess_effective_level(self, overall: int) -> str:
        if overall >= 85: return "VP / Architect level"
        elif overall >= 75: return "Staff Engineer level"
        elif overall >= 65: return "Senior Engineer level"
        elif overall >= 55: return "Mid-Level (SDE2) level"
        else: return "Below mid-level — needs more preparation"

    def _depth_summary(self, tracker: InterviewTracker) -> dict:
        """Per-concept depth breakdown for the scorecard."""
        depth_counts = {d.name: 0 for d in Depth}
        concept_details = []

        graph_concepts = tracker.graph.get("concepts", {})
        for cid, depth in sorted(tracker.covered_concepts.items(), key=lambda x: x[1].value, reverse=True):
            depth_counts[depth.name] += 1
            name = graph_concepts.get(cid, {}).get("name", cid)
            summary = tracker.concept_summaries.get(cid, "")
            concept_details.append({
                "concept": name,
                "depth": depth.name,
                "summary": summary[:150] if summary else "",
            })

        return {
            "total_concepts_mentioned": len(tracker.covered_concepts),
            "depth_distribution": depth_counts,
            "average_depth": round(
                sum(d.value for d in tracker.covered_concepts.values()) /
                max(len(tracker.covered_concepts), 1), 1
            ),
            "concept_details": concept_details,
        }

    def _recommend_lessons(self, scores: dict, tracker: InterviewTracker) -> list[dict]:
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
            ],
            "failure_handling": [
                {"topic": "replication", "lesson": "L1-intro", "title": "Data Replication"},
                {"topic": "cap-theorem", "lesson": "L1-intro", "title": "CAP Theorem"},
            ],
        }

        recs = []
        for dim, score in sorted(scores.items(), key=lambda x: x[1]):
            if score < 6 and dim in LESSON_MAP:
                for lesson in LESSON_MAP[dim]:
                    recs.append({"reason": f"Your {dim.replace('_', ' ')} scored {score}/10", **lesson})
        return recs[:5]


interview_scorer = InterviewScorer()
