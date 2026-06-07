"""
Layer 3: Interview Strategist
Decides what the interviewer should do next. Priority-based action selection.
Pure deterministic code, zero LLM.
"""
import random
from dataclasses import dataclass
from services.interview_tracker import InterviewTracker, Phase, Depth


@dataclass
class InterviewAction:
    priority: int
    action_type: str
    data: dict


PHASE_TRANSITIONS = {
    Phase.REQUIREMENTS: {
        "time": "Good questions. Let's start designing. Walk me through your high-level architecture.",
        "natural": "You have a solid understanding of the requirements. Let's design this system.",
    },
    Phase.HIGH_LEVEL: {
        "time": "Good overview. I want to dive deeper into one area.",
        "natural": "Nice high-level design. Let me probe into {area} specifically.",
    },
    Phase.DEEP_DIVE: {
        "time": "Good discussion. Let's talk about how this scales and what happens when things break.",
        "natural": "Let's zoom out. How does this handle 10x your current traffic? And what breaks first?",
    },
    Phase.SCALING_FAILURES: {
        "time": "We're running low on time. Any final thoughts on your design?",
        "natural": "Good discussion. Before we wrap up — anything you'd change or add to your design?",
    },
}


class InterviewStrategist:
    def decide_next_action(self, tracker: InterviewTracker, analysis: dict | None = None) -> InterviewAction:
        """Pick the highest-priority next action.

        Candidates are built as pure descriptions with NO side effects. Only after
        the winner is chosen do we apply its state mutation (advancing a phase,
        marking a contradiction addressed, consuming a follow-up or claim). Mutating
        during candidate construction was a bug: losing candidates would still
        advance the phase or consume a follow-up, silently corrupting later turns.
        """
        candidates: list[InterviewAction] = []
        # References needed to apply the winner's side effect after selection.
        contradiction_to_address = None
        claim_to_probe = None

        # PRIORITY 110: Handle stuck candidate — HIGHEST PRIORITY
        is_stuck = analysis.get("is_stuck", False) if analysis else False
        is_short = analysis.get("is_short_answer", False) if analysis else False
        consecutive_stuck = getattr(tracker, '_consecutive_stuck', 0)

        if is_stuck or (is_short and not analysis.get("concepts_mentioned")):
            tracker._consecutive_stuck = consecutive_stuck + 1

            # Pick the most important uncovered concept and give a hint
            uncovered = tracker.get_uncovered_concepts()
            graph_concepts = tracker.graph.get("concepts", {})

            if tracker._consecutive_stuck >= 3:
                # 3+ stuck answers — be very direct, almost teach
                hint_concept = uncovered[0] if uncovered else ""
                concept_name = graph_concepts.get(hint_concept, {}).get("name", "the next component")
                return InterviewAction(
                    priority=110,
                    action_type="give_strong_hint",
                    data={
                        "concept": hint_concept,
                        "hint": f"Let me help you. Think about {concept_name.lower()}. In a system like this, most engineers would start by figuring out the data storage — what database would you use, and why? Just pick one and we'll work from there.",
                        "stuck_count": tracker._consecutive_stuck,
                    },
                )
            elif tracker._consecutive_stuck >= 2:
                # 2 stuck — give a guided hint
                hint_concept = uncovered[0] if uncovered else ""
                concept_name = graph_concepts.get(hint_concept, {}).get("name", "")
                return InterviewAction(
                    priority=110,
                    action_type="give_hint",
                    data={
                        "concept": hint_concept,
                        "hint": f"No worries — let me point you in a direction. For this system, a key question is: how would you handle {concept_name.lower() if concept_name else 'the data storage'}? What technology comes to mind?",
                        "stuck_count": tracker._consecutive_stuck,
                    },
                )
            else:
                # First stuck — gentle nudge
                if tracker.phase == Phase.REQUIREMENTS:
                    return InterviewAction(
                        priority=110,
                        action_type="give_hint",
                        data={
                            "hint": "That's okay. Let me help — for requirements, think about: How many users? How many requests per second? What's more important, speed or consistency? These are the questions that shape the whole design.",
                            "stuck_count": 1,
                        },
                    )
                else:
                    hint_concept = uncovered[0] if uncovered else ""
                    concept_name = graph_concepts.get(hint_concept, {}).get("name", "the next piece")
                    return InterviewAction(
                        priority=110,
                        action_type="give_hint",
                        data={
                            "concept": hint_concept,
                            "hint": f"Let's try a different angle. What about {concept_name.lower()}? How would you approach that part?",
                            "stuck_count": 1,
                        },
                    )
        else:
            # Reset stuck counter on a real answer
            tracker._consecutive_stuck = 0

        # PRIORITY 100: Catch contradictions
        contradictions = tracker.get_unaddressed_contradictions()
        if contradictions:
            c = contradictions[0]
            contradiction_to_address = c
            candidates.append(InterviewAction(
                priority=100,
                action_type="catch_contradiction",
                data={
                    "old_claim": c.old_claim.text,
                    "new_claim": c.new_claim.text,
                    "old_exchange": c.old_claim.exchange,
                    "concept": c.old_claim.concept,
                },
            ))

        # PRIORITY 90: Phase transitions
        if tracker.should_transition_phase():
            transitions = PHASE_TRANSITIONS.get(tracker.phase, {})
            transition_text = transitions.get("time", "Let's move on.")

            # If transitioning to deep dive, include the target area
            if tracker.phase == Phase.HIGH_LEVEL:
                weak = tracker._find_weakest_dimension()
                transition_text = transition_text.replace("{area}", weak.replace("_", " "))

            # Peek the next phase for display — only actually advance if this wins.
            candidates.append(InterviewAction(
                priority=90,
                action_type="transition_phase",
                data={
                    "from_phase": tracker.phase,
                    "to_phase": tracker.peek_next_phase(),
                    "transition_text": transition_text,
                },
            ))

        # PRIORITY 80: Interview complete
        if tracker.is_interview_complete():
            candidates.append(InterviewAction(
                priority=80,
                action_type="end_interview",
                data={"message": "Thank you for walking me through your design. That's all the time we have."},
            ))

        # PRIORITY 75: Use LLM-suggested follow-up (context-aware, specific to what was said)
        if tracker.last_suggested_followup and len(tracker.last_suggested_followup) > 20:
            # The analyzer suggested a specific follow-up based on the candidate's actual words
            candidates.append(InterviewAction(
                priority=75,
                action_type="llm_followup",
                data={
                    "followup": tracker.last_suggested_followup,
                    "gaps": tracker.last_gaps,
                },
            ))

        # PRIORITY 70: Test untested claims (anti-BS)
        if tracker.untested_claims:
            claim = tracker.untested_claims[0]
            concept_data = tracker.graph.get("concepts", {}).get(claim.concept, {})
            probes = concept_data.get("probes", {})

            # Pick probe based on current depth
            current_depth = tracker.covered_concepts.get(claim.concept, Depth.NONE)
            if current_depth <= Depth.BUZZWORD:
                probe_list = probes.get("verify", probes.get("anti_bs", []))
            else:
                probe_list = probes.get("deepen", probes.get("verify", []))

            if probe_list:
                probe_text = random.choice(probe_list) if isinstance(probe_list, list) else probe_list
                claim_to_probe = claim
                candidates.append(InterviewAction(
                    priority=70,
                    action_type="probe_claim",
                    data={
                        "claim": claim.text,
                        "concept": claim.concept,
                        "probe_text": probe_text,
                        "depth": current_depth.name,
                    },
                ))

        # PRIORITY 60: Probe shallow areas
        shallow = tracker.get_shallow_concepts()
        if shallow:
            concept_id, depth = shallow[0]
            concept_data = tracker.graph.get("concepts", {}).get(concept_id, {})
            probes = concept_data.get("probes", {})
            probe_list = probes.get("deepen", probes.get("verify", []))

            if probe_list:
                probe_text = random.choice(probe_list) if isinstance(probe_list, list) else probe_list
                candidates.append(InterviewAction(
                    priority=60,
                    action_type="deepen",
                    data={
                        "concept": concept_id,
                        "concept_name": concept_data.get("name", concept_id),
                        "current_depth": depth.name,
                        "probe_text": probe_text,
                    },
                ))

        # PRIORITY 50: Cover missing rubric areas
        uncovered = tracker.get_uncovered_concepts()
        # Filter to concepts relevant to current phase
        phase_relevant = self._filter_by_phase(uncovered, tracker)
        if phase_relevant:
            concept_id = phase_relevant[0]
            concept_data = tracker.graph.get("concepts", {}).get(concept_id, {})
            candidates.append(InterviewAction(
                priority=50,
                action_type="redirect",
                data={
                    "concept": concept_id,
                    "concept_name": concept_data.get("name", concept_id),
                    "category": concept_data.get("category", ""),
                    "prompt": f"Let's talk about {concept_data.get('name', concept_id).lower()}. How would you approach that in this system?",
                },
            ))

        # PRIORITY 40: Challenge strong areas (Staff+ only)
        if tracker.effective_difficulty >= 3:
            strong = [(c, d) for c, d in tracker.covered_concepts.items() if d >= Depth.APPLIED]
            if strong:
                concept_id, _ = random.choice(strong)
                concept_data = tracker.graph.get("concepts", {}).get(concept_id, {})
                challenges = concept_data.get("probes", {}).get("challenge", [])
                if challenges:
                    candidates.append(InterviewAction(
                        priority=40,
                        action_type="challenge",
                        data={
                            "concept": concept_id,
                            "concept_name": concept_data.get("name", concept_id),
                            "probe_text": random.choice(challenges),
                        },
                    ))

        # PRIORITY 30: Phase-specific prompts
        if tracker.phase == Phase.SCALING_FAILURES:
            candidates.append(InterviewAction(
                priority=30,
                action_type="scaling_probe",
                data={
                    "prompt": random.choice([
                        "What's the first bottleneck you'd hit at 10x your current traffic?",
                        "If your primary database goes down right now, what happens to in-flight requests?",
                        "Walk me through what happens when your most critical service crashes at 3 AM.",
                        "Which component would you focus on making highly available first, and why?",
                    ]),
                },
            ))

        # PRIORITY 10: Open-ended fallback
        candidates.append(InterviewAction(
            priority=10,
            action_type="open_ended",
            data={
                "prompt": random.choice([
                    "What else would you add to this design?",
                    "Is there anything about this architecture that concerns you?",
                    "If you had unlimited engineering time, what would you improve first?",
                    "Walk me through how a request flows through your system end to end.",
                ]),
            },
        ))

        # Pick highest priority, then apply ONLY the winner's side effect.
        winner = max(candidates, key=lambda x: x.priority)

        if winner.action_type == "catch_contradiction" and contradiction_to_address:
            contradiction_to_address.addressed = True
        elif winner.action_type == "transition_phase":
            tracker.transition_phase()
        elif winner.action_type == "llm_followup":
            tracker.last_suggested_followup = ""  # consumed
        elif winner.action_type == "probe_claim" and claim_to_probe:
            claim_to_probe.tested = True
            if claim_to_probe in tracker.untested_claims:
                tracker.untested_claims.remove(claim_to_probe)

        return winner

    def _filter_by_phase(self, concepts: list[str], tracker: InterviewTracker) -> list[str]:
        """Filter concepts to those relevant to the current phase."""
        phase_categories = {
            Phase.REQUIREMENTS: ["requirements"],
            Phase.HIGH_LEVEL: ["encoding", "storage", "caching", "networking", "api", "architecture"],
            Phase.DEEP_DIVE: None,  # All categories
            Phase.SCALING_FAILURES: ["scaling", "failure", "monitoring"],
            Phase.WRAP_UP: [],
        }

        allowed = phase_categories.get(tracker.phase)
        if allowed is None:
            return concepts  # Deep dive: all categories
        if not allowed:
            return []

        graph_concepts = tracker.graph.get("concepts", {})
        return [
            c for c in concepts
            if graph_concepts.get(c, {}).get("category", "") in allowed
        ]


interview_strategist = InterviewStrategist()
