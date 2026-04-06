"""
Layer 4: Interview Speaker
Takes structured actions from the Strategist and turns them into natural speech.
Uses LLM with a strict system prompt to produce concise, in-character interviewer dialogue.

The system prompt enforces behavioral constraints (never give answers, never lecture,
stay concise, stay in character). The per-action prompts provide the specific context
for what to say.
"""
from pathlib import Path

from services.ollama_client import ollama_client
from services.interview_tracker import InterviewTracker

# Load the core system prompt once at module init
_PROMPT_DIR = Path(__file__).parent.parent / "prompts"
_SYSTEM_PROMPT = (_PROMPT_DIR / "interviewer_system.md").read_text()

# Import the detailed personas
from prompts.personas import INTERVIEWER_PERSONAS

# Backwards-compatible short personas for quick reference
PERSONAS = {
    level: {"name": p["name"], "tone": p["tone"], "style": p["behavior"][:200]}
    for level, p in INTERVIEWER_PERSONAS.items()
}


def _build_system(level: str) -> str:
    """Build the full system prompt for a given career level."""
    persona = INTERVIEWER_PERSONAS.get(level, INTERVIEWER_PERSONAS["senior"])
    return (
        f"{_SYSTEM_PROMPT}\n\n"
        f"---\n\n"
        f"## YOUR PERSONA: {persona['name']}\n\n"
        f"**Tone:** {persona['tone']}\n\n"
        f"**Behavioral Rules:**\n{persona['behavior']}\n\n"
        f"**What passing looks like at this level:**\n{persona['pass_bar']}\n"
    )


def _clean_response(text: str) -> str:
    """Strip meta-commentary, stage directions, and framing the LLM sometimes adds."""
    import re
    # Remove parenthetical notes: (Note: ...), (I'm keeping...), etc.
    text = re.sub(r'\((?:Note|I\'m|This|My|Here|Keep)[^)]*\)', '', text)
    # Remove asterisk actions: *pauses*, *smiles*, *nods*
    text = re.sub(r'\*[^*]+\*', '', text)
    # Remove "Here's my response:" or "Here's my attempt:" prefixes
    text = re.sub(r'^(?:Here\'?s?\s+(?:my|the|an?)\s+\w+[:\-—]\s*)+', '', text, flags=re.IGNORECASE)
    # Remove wrapping quotes if the entire response is quoted
    text = text.strip()
    if text.startswith('"') and text.endswith('"') and text.count('"') == 2:
        text = text[1:-1]
    return text.strip()


class InterviewSpeaker:
    async def generate_response(self, action: dict, tracker: InterviewTracker) -> str:
        """Generate natural interviewer speech from a structured action."""
        system = _build_system(tracker.level)
        action_type = action.action_type

        handlers = {
            "llm_followup": lambda: self._speak_llm_followup(action.data, system),
            "give_hint": lambda: self._speak_hint(action.data, system, strong=False),
            "give_strong_hint": lambda: self._speak_hint(action.data, system, strong=True),
            "catch_contradiction": lambda: self._speak_contradiction(action.data, system),
            "transition_phase": lambda: self._speak_transition(action.data, system),
            "probe_claim": lambda: self._speak_probe(action.data, system),
            "deepen": lambda: self._speak_deepen(action.data, system),
            "redirect": lambda: self._speak_redirect(action.data, system),
            "challenge": lambda: self._speak_challenge(action.data, system),
            "scaling_probe": lambda: self._speak_scaling(action.data, system),
            "end_interview": lambda: self._speak_closing(action.data, system, tracker),
            "open_ended": lambda: self._speak_open(action.data, system),
        }

        handler = handlers.get(action_type)
        if handler:
            raw = await handler()
        else:
            raw = action.data.get("prompt", "Tell me more about your design.")

        return _clean_response(raw)

    async def _speak_llm_followup(self, data: dict, system: str) -> str:
        """Deliver an LLM-generated follow-up question that's specific to what the candidate said."""
        followup = data.get("followup", "")
        gaps = data.get("gaps", [])
        gaps_context = f"\nGaps identified in their answer: {', '.join(gaps)}" if gaps else ""

        prompt = (
            f"ACTION: Ask a follow-up question based on what the candidate just said.\n"
            f"The analysis identified this follow-up: \"{followup}\""
            f"{gaps_context}\n\n"
            "Say this naturally as a conversational follow-up. Don't read it verbatim — "
            "rephrase it in your voice. You can combine it with a brief acknowledgment of "
            "what they said. 2-3 sentences."
        )
        return await ollama_client.generate(prompt, system=system, temperature=0.7)

    async def _speak_contradiction(self, data: dict, system: str) -> str:
        prompt = (
            f"ACTION: Catch a contradiction.\n"
            f"The candidate earlier said: \"{data['old_claim']}\"\n"
            f"But just now said: \"{data['new_claim']}\"\n\n"
            "Point out this inconsistency. Be direct but not hostile. "
            "Ask them to clarify which one they actually mean. 2-3 sentences."
        )
        return await ollama_client.generate(prompt, system=system, temperature=0.6)

    async def _speak_hint(self, data: dict, system: str, strong: bool = False) -> str:
        hint_text = data.get("hint", "Let me give you a starting point.")
        stuck_count = data.get("stuck_count", 1)

        if strong:
            prompt = (
                f"ACTION: The candidate has been stuck for {stuck_count} exchanges. Give them real help.\n"
                f"Guide them with something like: \"{hint_text}\"\n\n"
                "Be warm and collaborative — you're helping them get unstuck, not judging. "
                "Give a concrete starting point they can build on. "
                "Do NOT give the full answer. 3-4 sentences max."
            )
        else:
            prompt = (
                f"ACTION: The candidate seems unsure. Give a gentle nudge.\n"
                f"Guide them toward: \"{hint_text}\"\n\n"
                "Be encouraging but brief. Don't give the answer — just point them "
                "in the right direction. 2-3 sentences."
            )
        return await ollama_client.generate(prompt, system=system, temperature=0.7)

    async def _speak_transition(self, data: dict, system: str) -> str:
        prompt = (
            f"ACTION: Transition from {data.get('from_phase', '')} to {data.get('to_phase', '')}.\n"
            f"Say something like: \"{data.get('transition_text', 'Let us move on.')}\"\n\n"
            "Briefly acknowledge what they covered (1 sentence max), then redirect to the new area. "
            "2-3 sentences total."
        )
        return await ollama_client.generate(prompt, system=system, temperature=0.6)

    async def _speak_probe(self, data: dict, system: str) -> str:
        prompt = (
            f"ACTION: Probe the candidate's understanding of {data.get('concept', 'a component')}.\n"
            f"They claimed: \"{data.get('claim', '')}\"\n"
            f"Current depth: {data.get('depth', 'unknown')}\n"
            f"Ask this question naturally: \"{data['probe_text']}\"\n\n"
            "Make it conversational — don't read it like a script. 2-3 sentences."
        )
        return await ollama_client.generate(prompt, system=system, temperature=0.7)

    async def _speak_deepen(self, data: dict, system: str) -> str:
        prompt = (
            f"ACTION: Push deeper on {data.get('concept_name', 'something')}.\n"
            f"They covered it at {data.get('current_depth', 'surface')} level — you want more.\n"
            f"Ask: \"{data['probe_text']}\"\n\n"
            "Don't say 'you only covered this at surface level.' Just ask the deeper question "
            "as if it's the natural next thing to discuss. 2-3 sentences."
        )
        return await ollama_client.generate(prompt, system=system, temperature=0.7)

    async def _speak_redirect(self, data: dict, system: str) -> str:
        prompt = (
            f"ACTION: Steer the conversation toward {data.get('concept_name', 'an important area')}.\n"
            f"They haven't discussed this yet.\n\n"
            "Don't say 'you haven't mentioned this.' Instead, ask a question that naturally "
            "leads them to this topic. 2-3 sentences."
        )
        return await ollama_client.generate(prompt, system=system, temperature=0.7)

    async def _speak_challenge(self, data: dict, system: str) -> str:
        prompt = (
            f"ACTION: Challenge their confidence on {data.get('concept_name', 'their choice')}.\n"
            f"Push them with: \"{data['probe_text']}\"\n\n"
            "Be respectful but firm. Make them defend their decision. "
            "A real interviewer would push here. 2-3 sentences."
        )
        return await ollama_client.generate(prompt, system=system, temperature=0.7)

    async def _speak_scaling(self, data: dict, system: str) -> str:
        prompt = (
            f"ACTION: Ask about scaling or failure.\n"
            f"Question: \"{data['prompt']}\"\n\n"
            "Ask it naturally. 2-3 sentences."
        )
        return await ollama_client.generate(prompt, system=system, temperature=0.6)

    async def _speak_open(self, data: dict, system: str) -> str:
        prompt = data.get("prompt", "What else would you add to this design?")
        return await ollama_client.generate(
            f"ACTION: Open-ended prompt.\nSay naturally: \"{prompt}\"",
            system=system,
            temperature=0.7,
        )

    async def _speak_closing(self, data: dict, system: str, tracker: InterviewTracker) -> str:
        """Generate a natural interview closing."""
        # For closings, use a simple deterministic approach — no LLM needed
        return data.get("message", "That's all the time we have. Thank you for walking me through your design.")

    async def generate_opening(self, problem_title: str, tracker: InterviewTracker) -> str:
        """Generate the interview opening."""
        system = _build_system(tracker.level)
        persona = INTERVIEWER_PERSONAS.get(tracker.level, INTERVIEWER_PERSONAS["senior"])

        level_context = {
            "sde2": "This is a 30-minute interview. The system serves a growing startup with millions of users.",
            "senior": "This is a 40-minute interview. The system serves tens of millions of users.",
            "staff": "This is a 45-minute interview. The system serves hundreds of millions of users globally.",
            "principal": "This is a 50-minute interview. You're designing this across 50+ engineering teams.",
            "vp": "This is a 55-minute interview. The board wants this system as a strategic investment.",
        }

        prompt = (
            f"ACTION: Open the interview.\n"
            f"Problem: {problem_title}\n"
            f"Context: {level_context.get(tracker.level, '')}\n\n"
            "Introduce the problem in 1-2 sentences, then ask: "
            "'Before we start designing, what questions do you have about the requirements?'\n"
            "Keep it to 3-4 sentences total. Be natural — this is the first thing the candidate hears."
        )
        raw = await ollama_client.generate(prompt, system=system, temperature=0.7)
        return _clean_response(raw)


interview_speaker = InterviewSpeaker()
