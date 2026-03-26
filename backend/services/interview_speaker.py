"""
Layer 4: Interview Speaker
Takes structured actions from the Strategist and turns them into natural speech.
Uses 3B LLM for template→natural language conversion.
"""
from services.ollama_client import ollama_client
from services.interview_tracker import InterviewTracker

# Interviewer personas per career level
PERSONAS = {
    "sde2": {
        "name": "The Mentor",
        "tone": "warm, patient, encouraging",
        "style": "Give hints after one pause. Celebrate correct answers. Say things like 'That's a great start' and 'Have you considered...'",
    },
    "senior": {
        "name": "The Tech Lead",
        "tone": "friendly but rigorous",
        "style": "Ask 'why' after every decision. Expect the candidate to drive. Say 'Okay, but what's the trade-off here?'",
    },
    "staff": {
        "name": "The Principal Engineer",
        "tone": "direct, efficient, no hand-holding",
        "style": "Don't give hints. If the candidate is silent, wait. Probe failure modes. Say 'What are the user-visible consequences of that choice?'",
    },
    "principal": {
        "name": "The VP of Engineering",
        "tone": "peer conversation, strategic",
        "style": "Ask about team structure, build vs buy, cost implications. Say 'How would you organize the team to build this?' and 'What's the 3-year evolution plan?'",
    },
    "vp": {
        "name": "The CTO",
        "tone": "strategic, big-picture, business-aligned",
        "style": "Challenge business assumptions. Ask about compliance, cost at scale, vendor lock-in. Say 'What's the business impact if this fails?' and 'How does this align with a multi-product strategy?'",
    },
}


class InterviewSpeaker:
    async def generate_response(self, action: dict, tracker: InterviewTracker) -> str:
        """Generate natural interviewer speech from a structured action."""
        persona = PERSONAS.get(tracker.level, PERSONAS["senior"])
        action_type = action.action_type

        if action_type == "catch_contradiction":
            return await self._speak_contradiction(action.data, persona)
        elif action_type == "transition_phase":
            return await self._speak_transition(action.data, persona)
        elif action_type == "probe_claim":
            return await self._speak_probe(action.data, persona)
        elif action_type == "deepen":
            return await self._speak_deepen(action.data, persona)
        elif action_type == "redirect":
            return await self._speak_redirect(action.data, persona)
        elif action_type == "challenge":
            return await self._speak_challenge(action.data, persona)
        elif action_type == "scaling_probe":
            return await self._speak_scaling(action.data, persona)
        elif action_type == "end_interview":
            return action.data.get("message", "That's all the time we have. Thank you.")
        elif action_type == "open_ended":
            return await self._speak_open(action.data, persona)
        else:
            return action.data.get("prompt", "Tell me more about your design.")

    async def _speak_contradiction(self, data: dict, persona: dict) -> str:
        prompt = (
            f"You are {persona['name']}, a system design interviewer. "
            f"Tone: {persona['tone']}.\n\n"
            f"The candidate earlier said: \"{data['old_claim']}\"\n"
            f"But now said: \"{data['new_claim']}\"\n\n"
            "Point out this contradiction naturally. Don't be aggressive, "
            "but make it clear you noticed and need clarification. "
            "2-3 sentences max."
        )
        return await ollama_client.generate(prompt, temperature=0.7)

    async def _speak_transition(self, data: dict, persona: dict) -> str:
        base_text = data.get("transition_text", "Let's move on.")
        prompt = (
            f"You are {persona['name']}, a system design interviewer. "
            f"Tone: {persona['tone']}.\n\n"
            f"Say this transition naturally: \"{base_text}\"\n"
            f"Moving from {data.get('from_phase', '')} to {data.get('to_phase', '')}.\n"
            "Briefly acknowledge what they've covered, then redirect. "
            "2-3 sentences max."
        )
        return await ollama_client.generate(prompt, temperature=0.7)

    async def _speak_probe(self, data: dict, persona: dict) -> str:
        prompt = (
            f"You are {persona['name']}, a system design interviewer. "
            f"Tone: {persona['tone']}. {persona['style']}\n\n"
            f"The candidate mentioned {data.get('concept', 'a component')}.\n"
            f"Ask them this specific question naturally: \"{data['probe_text']}\"\n"
            "Make it conversational, not like reading from a script. "
            "2-3 sentences max."
        )
        return await ollama_client.generate(prompt, temperature=0.7)

    async def _speak_deepen(self, data: dict, persona: dict) -> str:
        prompt = (
            f"You are {persona['name']}, a system design interviewer. "
            f"Tone: {persona['tone']}. {persona['style']}\n\n"
            f"The candidate mentioned {data.get('concept_name', 'something')} "
            f"but only at a {data.get('current_depth', 'surface')} level.\n"
            f"Go deeper with this question: \"{data['probe_text']}\"\n"
            "Make it feel natural. Don't say 'you only covered this at a surface level.' "
            "2-3 sentences max."
        )
        return await ollama_client.generate(prompt, temperature=0.7)

    async def _speak_redirect(self, data: dict, persona: dict) -> str:
        prompt = (
            f"You are {persona['name']}, a system design interviewer. "
            f"Tone: {persona['tone']}.\n\n"
            f"The candidate hasn't discussed {data.get('concept_name', 'an important area')} yet.\n"
            "Naturally steer the conversation toward it. Don't say 'you haven't mentioned this.' "
            "Instead, ask a question that leads them there. "
            "2-3 sentences max."
        )
        return await ollama_client.generate(prompt, temperature=0.7)

    async def _speak_challenge(self, data: dict, persona: dict) -> str:
        prompt = (
            f"You are {persona['name']}, a system design interviewer. "
            f"Tone: {persona['tone']}. {persona['style']}\n\n"
            f"The candidate seems confident about {data.get('concept_name', 'their choice')}.\n"
            f"Challenge them with: \"{data['probe_text']}\"\n"
            "Be respectful but push them to defend their decision. "
            "2-3 sentences max."
        )
        return await ollama_client.generate(prompt, temperature=0.7)

    async def _speak_scaling(self, data: dict, persona: dict) -> str:
        prompt = (
            f"You are {persona['name']}, a system design interviewer. "
            f"Tone: {persona['tone']}.\n\n"
            f"Ask this scaling/failure question naturally: \"{data['prompt']}\"\n"
            "2-3 sentences max."
        )
        return await ollama_client.generate(prompt, temperature=0.7)

    async def _speak_open(self, data: dict, persona: dict) -> str:
        return data.get("prompt", "What else would you add to this design?")

    async def generate_opening(self, problem_title: str, tracker: InterviewTracker) -> str:
        """Generate the interview opening."""
        persona = PERSONAS.get(tracker.level, PERSONAS["senior"])

        level_context = {
            "sde2": f"The problem is scoped for a growing startup.",
            "senior": f"The system serves millions of users.",
            "staff": f"The system serves hundreds of millions of users globally.",
            "principal": f"You're designing this for a company with 50+ engineering teams.",
            "vp": f"You're the CTO. The board wants this system as a new product line.",
        }

        prompt = (
            f"You are {persona['name']}, a system design interviewer. "
            f"Tone: {persona['tone']}.\n\n"
            f"Start a system design interview for: {problem_title}\n"
            f"Context: {level_context.get(tracker.level, '')}\n\n"
            "Introduce the problem briefly, then ask: 'Before we dive in, "
            "what questions do you have about the requirements?'\n"
            "Keep it to 3-4 sentences. Be natural."
        )
        return await ollama_client.generate(prompt, temperature=0.7)


interview_speaker = InterviewSpeaker()
