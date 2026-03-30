#!/usr/bin/env python3
"""
Production Training Data Generation Pipeline for ArchitectIQ.

Generates thousands of synthetic system design interview conversations using Claude API.
Features:
  - Async parallel generation (50+ concurrent calls)
  - Few-shot examples from seed data for quality
  - Data augmentation (rephrase existing conversations cheaply)
  - JSON repair and retry logic
  - Resume from interruption
  - Real-time cost tracking and progress
  - Configurable models per task type

Usage:
  # Generate new conversations
  python generate_training_data.py generate --count 1000 --parallel 50

  # Augment existing conversations (3-5x data multiplication)
  python generate_training_data.py augment --multiplier 3 --parallel 50

  # Resume interrupted generation
  python generate_training_data.py generate --count 1000 --parallel 50 --resume

  # Estimate cost
  python generate_training_data.py estimate --count 10000

Cost estimates (Claude Sonnet for generation, Haiku for augmentation):
  1,000 new conversations    ~ $150-250
  1,000 augmented copies     ~ $15-30
  To reach 10GB (~500K files):
    - 50K new + 450K augmented ~ $10K-15K
    - Pure new generation      ~ $75K-150K
"""
import argparse
import asyncio
import json
import os
import random
import re
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

try:
    import anthropic
except ImportError:
    print("pip install anthropic")
    sys.exit(1)

# ============================================================
# CONFIGURATION
# ============================================================

PROBLEMS = [
    {
        "id": "url-shortener",
        "title": "Design a URL Shortener",
        "context": "100M new URLs/day, 100:1 read-write ratio, <50ms redirect latency, 5-year retention",
        "key_concepts": ["base62 encoding", "database choice", "caching layer", "sharding", "analytics pipeline", "collision handling", "301 vs 302 redirect"],
    },
    {
        "id": "rate-limiter",
        "title": "Design a Rate Limiter",
        "context": "Distributed across multiple API gateways, per-user and per-IP, 1M+ requests/sec",
        "key_concepts": ["token bucket", "sliding window", "Redis", "Lua scripts", "race conditions", "distributed coordination", "graceful degradation"],
    },
    {
        "id": "key-value-store",
        "title": "Design a Distributed Key-Value Store",
        "context": "Billions of keys, tunable consistency, high availability, automatic failover",
        "key_concepts": ["consistent hashing", "quorum reads/writes", "vector clocks", "gossip protocol", "Merkle trees", "WAL", "hinted handoff"],
    },
    {
        "id": "twitter-feed",
        "title": "Design Twitter/Instagram Feed",
        "context": "500M DAU, celebrities with 50M+ followers, <200ms feed load, real-time updates",
        "key_concepts": ["fan-out on write vs read", "celebrity problem", "timeline cache", "Snowflake IDs", "feed ranking", "trending topics", "count-min sketch"],
    },
    {
        "id": "chat-system",
        "title": "Design WhatsApp/Slack",
        "context": "100M DAU, 10M concurrent WebSockets, message ordering guarantees, E2E encryption",
        "key_concepts": ["WebSocket management", "message ordering", "presence system", "group messaging", "push notifications", "Signal protocol", "delivery receipts"],
    },
    {
        "id": "video-streaming",
        "title": "Design YouTube/Netflix",
        "context": "Billions of video views/day, adaptive bitrate, global CDN, live streaming",
        "key_concepts": ["transcoding pipeline", "adaptive bitrate (HLS/DASH)", "CDN edge caching", "chunked upload", "recommendation engine", "view counting", "live streaming"],
    },
    {
        "id": "search-engine",
        "title": "Design Google Search",
        "context": "Billions of web pages indexed, <200ms query latency, relevance ranking, spell correction",
        "key_concepts": ["web crawler", "inverted index", "TF-IDF/BM25", "PageRank", "query parsing", "index sharding", "distributed crawling"],
    },
    {
        "id": "ride-sharing",
        "title": "Design Uber",
        "context": "Millions of active drivers, real-time matching, ETA computation, surge pricing",
        "key_concepts": ["geohashing", "driver matching", "ETA computation", "trip state machine", "surge pricing", "real-time tracking", "dispatch partitioning"],
    },
    {
        "id": "payment-system",
        "title": "Design Stripe",
        "context": "Millions of transactions/day, PCI compliance, multi-currency, fraud detection",
        "key_concepts": ["idempotency keys", "double-entry bookkeeping", "payment lifecycle", "fraud detection", "PCI tokenization", "reconciliation", "saga pattern"],
    },
    {
        "id": "message-queue-design",
        "title": "Design Kafka",
        "context": "Millions of messages/sec, exactly-once semantics, ordered delivery, retention",
        "key_concepts": ["append-only log", "partitions", "consumer groups", "ISR replication", "offset management", "compaction", "idempotent producers"],
    },
]

LEVELS = [
    {
        "id": "sde2",
        "title": "SDE2 / Mid-Level",
        "persona": "The Mentor — warm, patient, encouraging. Give hints after one pause. Celebrate correct answers.",
        "duration": "30 minutes",
        "expectations": "Can design a basic working system. Forgiven for missing capacity estimation and failure handling.",
        "pass_bar": 55,
    },
    {
        "id": "senior",
        "title": "Senior Engineer",
        "persona": "The Tech Lead — friendly but rigorous. Ask 'why' after every decision. Expect trade-off discussion.",
        "duration": "40 minutes",
        "expectations": "Solid design with trade-offs. Should do capacity estimation. Basic failure handling expected.",
        "pass_bar": 65,
    },
    {
        "id": "staff",
        "title": "Staff Engineer",
        "persona": "The Principal Engineer — direct, efficient, no hand-holding. Probe failure modes. Expect depth.",
        "duration": "45 minutes",
        "expectations": "Deep design with math, trade-off matrices, failure cascading analysis. Should drive the conversation.",
        "pass_bar": 75,
    },
    {
        "id": "principal",
        "title": "Principal Engineer",
        "persona": "The VP of Engineering — peer conversation, challenges assumptions. Ask about team structure and build-vs-buy.",
        "duration": "50 minutes",
        "expectations": "Architecture spanning teams. Cost analysis. Migration strategy. Multi-region. Org-level trade-offs.",
        "pass_bar": 80,
    },
    {
        "id": "vp",
        "title": "VP / Architect",
        "persona": "The CTO — strategic, big-picture. Challenge business assumptions. Ask about compliance, 3-year evolution.",
        "duration": "55 minutes",
        "expectations": "Strategic technical leadership. Build-vs-buy framework. Compliance. Team structure implications.",
        "pass_bar": 85,
    },
]

CANDIDATE_PROFILES = [
    {
        "id": "strong",
        "name": "Strong Candidate",
        "description": "Well-prepared, asks good questions, does math, discusses trade-offs. Makes minor mistakes but recovers. Drives the conversation.",
        "score_range": [72, 92],
    },
    {
        "id": "good",
        "name": "Good Candidate",
        "description": "Solid fundamentals, makes reasonable choices. Misses some depth. Needs occasional nudging but doesn't get stuck.",
        "score_range": [58, 75],
    },
    {
        "id": "mediocre",
        "name": "Mediocre Candidate",
        "description": "Knows the basics but struggles with scale and failure modes. Gives surface-level answers. Needs hints but can follow them.",
        "score_range": [40, 60],
    },
    {
        "id": "struggling",
        "name": "Struggling Candidate",
        "description": "Gets stuck frequently. Gives vague answers. Needs multiple hints. Shows some potential when guided but can't drive independently.",
        "score_range": [25, 45],
    },
    {
        "id": "bs_artist",
        "name": "Buzzword Dropper",
        "description": "Drops technology names without understanding. Says 'use Kafka' but can't explain why. Changes topic when probed. Contradicts themselves.",
        "score_range": [20, 40],
    },
    {
        "id": "experienced_weak_communicator",
        "name": "Experienced but Poor Communicator",
        "description": "Actually knows the material but explains poorly. Jumps between topics. Doesn't structure answers. Misses obvious things then nails obscure details.",
        "score_range": [45, 65],
    },
    {
        "id": "textbook_no_experience",
        "name": "Textbook Knowledge, No Experience",
        "description": "Can recite definitions perfectly but has never built anything at scale. Gives correct but generic answers. Falls apart on 'what happens when X fails in production?'",
        "score_range": [35, 55],
    },
    {
        "id": "senior_aiming_higher",
        "name": "Strong Senior Reaching for Staff",
        "description": "Excellent at single-service design. Struggles when asked about cross-team concerns, org impact, or migration strategies. Technical depth is there but strategic thinking is developing.",
        "score_range": [60, 80],
    },
]

# ============================================================
# FEW-SHOT EXAMPLES (loaded from seed data)
# ============================================================

def load_few_shot_examples(seed_dir: Path, count: int = 3) -> list[dict]:
    """Load the best seed conversations as few-shot examples."""
    candidates = []
    for f in seed_dir.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            score = data.get("scorecard", {}).get("overall", 0)
            exchanges = len(data.get("conversation", []))
            profile = data.get("metadata", {}).get("candidate_profile", "")
            # Prefer diverse, high-quality examples
            candidates.append((f, data, score, exchanges, profile))
        except (json.JSONDecodeError, KeyError):
            continue

    # Pick diverse examples: one strong, one mediocre, one struggling
    examples = []
    target_profiles = ["strong", "mediocre", "struggling"]
    for target in target_profiles:
        matching = [c for c in candidates if c[4] == target and c[3] >= 18]
        if matching:
            # Pick highest-exchange count for richness
            matching.sort(key=lambda x: x[3], reverse=True)
            examples.append(matching[0][1])
        if len(examples) >= count:
            break

    # Fill remaining with random high-quality examples
    while len(examples) < count:
        remaining = [c for c in candidates if c[1] not in examples and c[3] >= 18]
        if not remaining:
            break
        examples.append(random.choice(remaining)[1])

    return examples


def format_few_shot(examples: list[dict]) -> str:
    """Format few-shot examples for inclusion in the prompt."""
    if not examples:
        return ""

    parts = ["\n\nHere are examples of high-quality conversations for reference. Match this level of detail and annotation quality:\n"]
    for i, ex in enumerate(examples):
        # Truncate to first 6 exchanges to save tokens
        truncated = {
            "metadata": ex.get("metadata", {}),
            "conversation": ex.get("conversation", [])[:6],
            "scorecard": ex.get("scorecard", {}),
        }
        parts.append(f"\n--- EXAMPLE {i+1} (first 6 exchanges shown) ---\n{json.dumps(truncated, indent=2)}\n")

    return "\n".join(parts)


# ============================================================
# GENERATION PROMPT
# ============================================================

GENERATION_PROMPT = """Generate a COMPLETE system design interview conversation as a JSON object.

INTERVIEW SETUP:
- Problem: {problem_title}
- Context: {problem_context}
- Key concepts to potentially cover: {key_concepts}
- Career level: {level_title}
- Interview duration: {duration}
- Interviewer persona: {persona}
- Level expectations: {expectations}

CANDIDATE PROFILE:
- Type: {candidate_name}
- Behavior: {candidate_description}
- Expected score range: {score_range}

INTERVIEW STRUCTURE:
Phase 1 - REQUIREMENTS (3-5 exchanges): Candidate asks clarifying questions. Interviewer answers with specific numbers.
Phase 2 - HIGH-LEVEL DESIGN (5-8 exchanges): Candidate presents architecture. Interviewer probes decisions.
Phase 3 - DEEP DIVE (4-6 exchanges): Interviewer picks the weakest area and goes deep. Tests real understanding.
Phase 4 - SCALING & FAILURES (3-4 exchanges): "What happens at 10x?" and "What if X crashes?"
Phase 5 - WRAP-UP (1-2 exchanges): Final thoughts, anything to add.

INTERVIEWER RULES:
- NEVER give answers. Only ask questions and give minimal hints when candidate is stuck.
- PROBE when candidate names a technology without explaining why ("You said Redis. Why Redis specifically?")
- CHALLENGE when candidate seems confident ("Your teammate argues for DynamoDB instead. Make the case for your choice.")
- CATCH CONTRADICTIONS ("Earlier you said eventual consistency is fine. But now you're describing a system that requires strong consistency.")
- GIVE HINTS only when stuck for 2+ exchanges, and make hints subtle, not answers
- TRANSITION between phases explicitly ("Good overview. Let's dive into the database design specifically.")
- USE SPECIFIC NUMBERS when answering requirements ("Assume 100M URLs/day, 100:1 read-write ratio")
- Keep responses to 2-4 sentences. Real interviewers are concise.
- Stay in character as {persona}

CANDIDATE RULES:
- Behave exactly as a {candidate_name} would
- {candidate_description}
- Make realistic mistakes appropriate to this profile
- Show genuine thought process, including uncertainty
- Don't be perfect — real candidates stumble, backtrack, and think out loud

DIVERSITY INSTRUCTIONS:
- Vary the candidate's communication style: some candidates are verbose, others terse
- Include domain-specific references from the candidate's "background" — a candidate who worked at a fintech will reference payment flows differently than one from a social media company
- Vary interviewer style within the persona — some probe immediately, others let the candidate run
- Do NOT follow a formulaic pattern. Real interviews are messy and organic.
- The candidate should occasionally use filler words, self-correct, or change direction mid-sentence
{few_shot_section}
OUTPUT FORMAT — respond with ONLY valid JSON (no markdown, no code fences):
{{
  "metadata": {{
    "problem_id": "{problem_id}",
    "level": "{level_id}",
    "candidate_profile": "{candidate_id}",
    "total_exchanges": <number>,
    "generation_id": "{gen_id}"
  }},
  "conversation": [
    {{
      "role": "interviewer",
      "content": "The actual spoken text",
      "annotation": {{
        "action": "opening|answer_requirements|probe|deepen|challenge|hint|catch_contradiction|redirect|transition|scaling_probe|failure_probe|wrap_up|acknowledge",
        "phase": "requirements|high_level_design|deep_dive|scaling_failures|wrap_up",
        "target_concept": "concept_being_discussed_or_null"
      }}
    }},
    {{
      "role": "candidate",
      "content": "The actual spoken text",
      "annotation": {{
        "quality": "strong|good|mediocre|weak|stuck",
        "concepts_mentioned": ["list", "of", "concepts"],
        "depth": "deep|applied|surface|buzzword|none",
        "has_reasoning": true/false,
        "has_numbers": true/false,
        "has_tradeoffs": true/false
      }}
    }}
  ],
  "scorecard": {{
    "overall": <0-100>,
    "passed": true/false,
    "dimensions": {{
      "requirements_gathering": <0-10>,
      "capacity_estimation": <0-10>,
      "api_design": <0-10>,
      "database_design": <0-10>,
      "caching_strategy": <0-10>,
      "scalability": <0-10>,
      "failure_handling": <0-10>,
      "communication": <0-10>
    }},
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"]
  }}
}}

Generate 18-25 exchanges. Make it feel like a REAL interview — natural flow, realistic pacing, genuine mistakes and recovery. The conversation should be rich enough to train a model on."""


AUGMENTATION_PROMPT = """You are a data augmentation system. Take this system design interview conversation and create a VARIATION of it.

RULES FOR VARIATION:
- Keep the same problem, level, candidate profile, and approximate score
- CHANGE the specific technologies mentioned (e.g., swap PostgreSQL for MySQL, Redis for Memcached)
- REPHRASE all dialogue — same meaning, different words and sentence structure
- VARY the communication style — if the original is formal, make it slightly more casual (or vice versa)
- CHANGE specific numbers while keeping the order of magnitude similar (e.g., 100M -> 80M, 5 years -> 3 years)
- ADD or REMOVE 1-2 exchanges (keep within 16-27 total)
- SHIFT the deep-dive topic — if original went deep on caching, go deep on database design instead
- Keep annotations accurate for the new content
- The overall quality level and score should stay within ±5 points of the original
- Maintain the same JSON structure exactly

ORIGINAL CONVERSATION:
{original_json}

Generate the VARIATION as valid JSON only (no markdown, no code fences). Make it feel like a completely different interview with a different candidate at a similar skill level discussing the same problem."""


# ============================================================
# JSON REPAIR
# ============================================================

def repair_json(raw: str) -> Optional[dict]:
    """Attempt to parse and repair malformed JSON from LLM output."""
    # Strip markdown code fences
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
        raw = re.sub(r"\n?```\s*$", "", raw)

    # Try direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Fix common issues: trailing commas
    fixed = re.sub(r",\s*([}\]])", r"\1", raw)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Fix: true/false not quoted but used as Python-style True/False
    fixed = fixed.replace(": True", ": true").replace(": False", ": false")
    fixed = fixed.replace(": None", ": null")
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Try to find JSON object boundaries
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start >= 0 and end > start:
        snippet = raw[start:end]
        snippet = re.sub(r",\s*([}\]])", r"\1", snippet)
        snippet = snippet.replace(": True", ": true").replace(": False", ": false")
        try:
            return json.loads(snippet)
        except json.JSONDecodeError:
            pass

    return None


def validate_conversation(data: dict) -> tuple[bool, str]:
    """Validate that a generated conversation meets quality standards."""
    if "conversation" not in data:
        return False, "missing 'conversation' field"
    if "scorecard" not in data:
        return False, "missing 'scorecard' field"
    if "metadata" not in data:
        return False, "missing 'metadata' field"

    conv = data["conversation"]
    if len(conv) < 12:
        return False, f"too few exchanges ({len(conv)}, need >= 12)"
    if len(conv) > 40:
        return False, f"too many exchanges ({len(conv)}, max 40)"

    # Check alternating roles
    for i, msg in enumerate(conv):
        expected_role = "interviewer" if i % 2 == 0 else "candidate"
        if msg.get("role") != expected_role:
            # Not strictly alternating — still valid in some cases
            pass
        if "content" not in msg or not msg["content"].strip():
            return False, f"empty content at exchange {i}"
        if "annotation" not in msg:
            return False, f"missing annotation at exchange {i}"

    scorecard = data["scorecard"]
    if "overall" not in scorecard:
        return False, "missing overall score"
    if not isinstance(scorecard["overall"], (int, float)):
        return False, "overall score is not a number"
    if scorecard["overall"] < 0 or scorecard["overall"] > 100:
        return False, f"overall score out of range: {scorecard['overall']}"

    return True, "ok"


# ============================================================
# COST TRACKING
# ============================================================

# Approximate token costs (per 1M tokens, as of 2025)
MODEL_COSTS = {
    "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.0},
    "claude-opus-4-20250514": {"input": 15.0, "output": 75.0},
}

@dataclass
class CostTracker:
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = "claude-sonnet-4-20250514"
    generated: int = 0
    failed: int = 0
    start_time: float = field(default_factory=time.time)

    @property
    def cost_usd(self) -> float:
        rates = MODEL_COSTS.get(self.model, {"input": 3.0, "output": 15.0})
        return (self.input_tokens * rates["input"] + self.output_tokens * rates["output"]) / 1_000_000

    @property
    def avg_cost_per_conversation(self) -> float:
        if self.generated == 0:
            return 0
        return self.cost_usd / self.generated

    @property
    def elapsed_minutes(self) -> float:
        return (time.time() - self.start_time) / 60

    @property
    def rate_per_minute(self) -> float:
        elapsed = self.elapsed_minutes
        if elapsed == 0:
            return 0
        return self.generated / elapsed

    def add(self, usage):
        """Add usage from an API response."""
        if hasattr(usage, "input_tokens"):
            self.input_tokens += usage.input_tokens
            self.output_tokens += usage.output_tokens
        elif isinstance(usage, dict):
            self.input_tokens += usage.get("input_tokens", 0)
            self.output_tokens += usage.get("output_tokens", 0)

    def summary(self) -> str:
        return (
            f"Generated: {self.generated} | Failed: {self.failed} | "
            f"Cost: ${self.cost_usd:.2f} (${self.avg_cost_per_conversation:.3f}/conv) | "
            f"Rate: {self.rate_per_minute:.1f}/min | "
            f"Elapsed: {self.elapsed_minutes:.1f}min"
        )


# ============================================================
# PROGRESS / RESUME
# ============================================================

class ProgressTracker:
    """Track generation progress for resume support."""

    def __init__(self, output_dir: Path, batch_id: str):
        self.progress_file = output_dir / batch_id / ".progress.json"
        self.completed: set[str] = set()
        self._load()

    def _load(self):
        if self.progress_file.exists():
            try:
                data = json.loads(self.progress_file.read_text())
                self.completed = set(data.get("completed", []))
            except (json.JSONDecodeError, KeyError):
                self.completed = set()

    def save(self):
        self.progress_file.parent.mkdir(parents=True, exist_ok=True)
        self.progress_file.write_text(json.dumps({
            "completed": list(self.completed),
            "count": len(self.completed),
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S"),
        }, indent=2))

    def mark_done(self, combo_id: str):
        self.completed.add(combo_id)
        # Save every 10 completions
        if len(self.completed) % 10 == 0:
            self.save()

    def is_done(self, combo_id: str) -> bool:
        return combo_id in self.completed


# ============================================================
# ASYNC GENERATION ENGINE
# ============================================================

class AsyncTrainingDataGenerator:
    def __init__(
        self,
        api_key: str,
        output_dir: str,
        gen_model: str = "claude-sonnet-4-20250514",
        aug_model: str = "claude-haiku-4-5-20251001",
        max_parallel: int = 50,
        seed_dir: str = "data/training/seed",
    ):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.gen_model = gen_model
        self.aug_model = aug_model
        self.max_parallel = max_parallel
        self.semaphore = asyncio.Semaphore(max_parallel)
        self.seed_dir = Path(seed_dir)

        # Load few-shot examples
        if self.seed_dir.exists():
            self.few_shot_examples = load_few_shot_examples(self.seed_dir, count=3)
            print(f"Loaded {len(self.few_shot_examples)} few-shot examples from seed data")
        else:
            self.few_shot_examples = []
            print("No seed directory found — generating without few-shot examples")

    async def generate_one(
        self, problem: dict, level: dict, profile: dict,
        gen_id: str, cost: CostTracker, retries: int = 3,
    ) -> Optional[dict]:
        """Generate a single interview conversation with retries."""
        few_shot = format_few_shot(self.few_shot_examples)

        prompt = GENERATION_PROMPT.format(
            problem_id=problem["id"],
            problem_title=problem["title"],
            problem_context=problem["context"],
            key_concepts=", ".join(problem["key_concepts"]),
            level_id=level["id"],
            level_title=level["title"],
            persona=level["persona"],
            duration=level["duration"],
            expectations=level["expectations"],
            candidate_id=profile["id"],
            candidate_name=profile["name"],
            candidate_description=profile["description"],
            score_range=f"{profile['score_range'][0]}-{profile['score_range'][1]}",
            gen_id=gen_id,
            few_shot_section=few_shot,
        )

        for attempt in range(retries):
            try:
                async with self.semaphore:
                    response = await self.client.messages.create(
                        model=self.gen_model,
                        max_tokens=8192,
                        messages=[{"role": "user", "content": prompt}],
                    )

                cost.add(response.usage)
                raw = response.content[0].text
                data = repair_json(raw)

                if data is None:
                    if attempt < retries - 1:
                        await asyncio.sleep(1)
                        continue
                    return None

                valid, reason = validate_conversation(data)
                if not valid:
                    if attempt < retries - 1:
                        await asyncio.sleep(1)
                        continue
                    print(f"    [WARN] Validation failed after {retries} attempts: {reason}")
                    return None

                return data

            except anthropic.RateLimitError:
                wait = 2 ** (attempt + 1) + random.random() * 2
                print(f"    [RATE LIMIT] Waiting {wait:.1f}s...")
                await asyncio.sleep(wait)
            except anthropic.APIError as e:
                if attempt < retries - 1:
                    await asyncio.sleep(2)
                else:
                    print(f"    [ERROR] API error after {retries} attempts: {e}")
                    return None
            except Exception as e:
                print(f"    [ERROR] Unexpected: {e}")
                return None

        return None

    async def augment_one(
        self, original: dict, cost: CostTracker, retries: int = 2,
    ) -> Optional[dict]:
        """Create a variation of an existing conversation."""
        prompt = AUGMENTATION_PROMPT.format(
            original_json=json.dumps(original, indent=2)
        )

        for attempt in range(retries):
            try:
                async with self.semaphore:
                    response = await self.client.messages.create(
                        model=self.aug_model,
                        max_tokens=8192,
                        messages=[{"role": "user", "content": prompt}],
                    )

                cost.add(response.usage)
                raw = response.content[0].text
                data = repair_json(raw)

                if data is None:
                    if attempt < retries - 1:
                        continue
                    return None

                valid, reason = validate_conversation(data)
                if not valid:
                    if attempt < retries - 1:
                        continue
                    return None

                # Update generation ID to mark as augmented
                if "metadata" in data:
                    data["metadata"]["generation_id"] = f"aug_{str(uuid.uuid4())[:8]}"
                    data["metadata"]["augmented_from"] = original.get("metadata", {}).get("generation_id", "unknown")

                return data

            except anthropic.RateLimitError:
                wait = 2 ** (attempt + 1)
                await asyncio.sleep(wait)
            except Exception as e:
                if attempt == retries - 1:
                    print(f"    [ERROR] Augmentation failed: {e}")
                return None

        return None

    def save(self, data: dict, batch_dir: Path) -> str:
        """Save a conversation to disk. Returns the filename."""
        meta = data.get("metadata", {})
        gen_id = meta.get("generation_id", str(uuid.uuid4())[:8])
        problem = meta.get("problem_id", "unknown")
        level = meta.get("level", "unknown")
        profile = meta.get("candidate_profile", "unknown")

        filename = f"{problem}_{level}_{profile}_{gen_id}.json"
        filepath = batch_dir / filename

        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

        return filename

    async def _generate_task(
        self, idx: int, total: int, problem: dict, level: dict, profile: dict,
        batch_dir: Path, cost: CostTracker, progress: ProgressTracker,
    ):
        """Single generation task for async execution."""
        combo_id = f"{problem['id']}_{level['id']}_{profile['id']}_{idx}"
        if progress.is_done(combo_id):
            return

        label = f"[{idx+1}/{total}] {problem['id']}/{level['id']}/{profile['id']}"
        gen_id = f"gen_{str(uuid.uuid4())[:8]}"

        data = await self.generate_one(problem, level, profile, gen_id, cost)
        if data:
            self.save(data, batch_dir)
            cost.generated += 1
            progress.mark_done(combo_id)
            exchanges = len(data.get("conversation", []))
            score = data.get("scorecard", {}).get("overall", "?")
            print(f"  {label} -> OK ({exchanges} exch, score={score}) | {cost.summary()}")
        else:
            cost.failed += 1
            print(f"  {label} -> FAILED | {cost.summary()}")

    async def generate_batch(self, count: int, batch_id: Optional[str] = None, resume: bool = False):
        """Generate a batch of conversations with async parallelism."""
        if not batch_id:
            batch_id = f"batch_{int(time.time())}"

        batch_dir = self.output_dir / batch_id
        batch_dir.mkdir(parents=True, exist_ok=True)

        progress = ProgressTracker(self.output_dir, batch_id)
        if resume:
            print(f"Resuming — {len(progress.completed)} already completed")

        # Build all combinations
        combos = []
        for problem in PROBLEMS:
            for level in LEVELS:
                for profile in CANDIDATE_PROFILES:
                    combos.append((problem, level, profile))

        # Shuffle and take requested count
        random.shuffle(combos)
        if count < len(combos):
            combos = combos[:count]
        else:
            base = combos.copy()
            while len(combos) < count:
                combos.extend(random.sample(base, min(len(base), count - len(combos))))
            combos = combos[:count]

        remaining = count - len(progress.completed) if resume else count
        print(f"\n{'='*60}")
        print(f"GENERATION RUN")
        print(f"  Conversations: {count} ({remaining} remaining)")
        print(f"  Parallelism:   {self.max_parallel}")
        print(f"  Model:         {self.gen_model}")
        print(f"  Output:        {batch_dir}")
        print(f"  Combinations:  {len(PROBLEMS)}×{len(LEVELS)}×{len(CANDIDATE_PROFILES)} = {len(PROBLEMS)*len(LEVELS)*len(CANDIDATE_PROFILES)}")
        print(f"{'='*60}\n")

        cost = CostTracker(model=self.gen_model)

        # Launch all tasks
        tasks = []
        for i, (problem, level, profile) in enumerate(combos):
            task = self._generate_task(i, count, problem, level, profile, batch_dir, cost, progress)
            tasks.append(task)

        await asyncio.gather(*tasks)

        progress.save()

        print(f"\n{'='*60}")
        print(f"COMPLETE — {cost.summary()}")
        print(f"Files in: {batch_dir}")

        total_size = sum(f.stat().st_size for f in batch_dir.glob("*.json"))
        print(f"Batch size: {total_size / 1024 / 1024:.1f} MB")

        if cost.generated > 0:
            avg_size = total_size / cost.generated
            files_for_10gb = int(10 * 1024 * 1024 * 1024 / avg_size)
            est_cost = files_for_10gb * cost.avg_cost_per_conversation
            print(f"Estimated to reach 10GB: {files_for_10gb:,} files, ~${est_cost:,.0f}")
        print(f"{'='*60}\n")

    async def augment_batch(
        self, multiplier: int = 3, batch_id: Optional[str] = None,
        source_dirs: Optional[list[str]] = None,
    ):
        """Augment existing conversations to multiply data volume."""
        if not batch_id:
            batch_id = f"augmented_{int(time.time())}"

        batch_dir = self.output_dir / batch_id
        batch_dir.mkdir(parents=True, exist_ok=True)

        # Collect source files
        source_files = []
        dirs_to_scan = source_dirs or [str(self.seed_dir)]
        for d in dirs_to_scan:
            p = Path(d)
            if p.exists():
                source_files.extend(list(p.glob("*.json")))

        # Also scan generated batches in output_dir
        for sub in self.output_dir.iterdir():
            if sub.is_dir() and sub.name.startswith("batch_"):
                source_files.extend(list(sub.glob("*.json")))

        print(f"\n{'='*60}")
        print(f"AUGMENTATION RUN")
        print(f"  Source files:  {len(source_files)}")
        print(f"  Multiplier:    {multiplier}x")
        print(f"  Target output: {len(source_files) * multiplier} conversations")
        print(f"  Model:         {self.aug_model}")
        print(f"  Output:        {batch_dir}")
        print(f"{'='*60}\n")

        cost = CostTracker(model=self.aug_model)

        async def augment_task(source_file: Path, variation_idx: int):
            try:
                original = json.loads(source_file.read_text())
            except (json.JSONDecodeError, FileNotFoundError):
                return

            label = f"{source_file.stem} v{variation_idx+1}"
            data = await self.augment_one(original, cost)
            if data:
                self.save(data, batch_dir)
                cost.generated += 1
                if cost.generated % 25 == 0:
                    print(f"  {label} -> OK | {cost.summary()}")
            else:
                cost.failed += 1

        tasks = []
        for source_file in source_files:
            for v in range(multiplier):
                tasks.append(augment_task(source_file, v))

        # Shuffle to distribute load across problem types
        random.shuffle(tasks)
        await asyncio.gather(*tasks)

        print(f"\n{'='*60}")
        print(f"AUGMENTATION COMPLETE — {cost.summary()}")
        total_size = sum(f.stat().st_size for f in batch_dir.glob("*.json"))
        print(f"Batch size: {total_size / 1024 / 1024:.1f} MB")
        print(f"{'='*60}\n")


# ============================================================
# COST ESTIMATOR
# ============================================================

def estimate_cost(count: int, multiplier: int = 3, gen_model: str = "claude-sonnet-4-20250514", aug_model: str = "claude-haiku-4-5-20251001"):
    """Estimate cost to reach target conversation count."""
    # Average tokens per conversation (from empirical measurement of seed data)
    avg_input_tokens = 2000   # prompt
    avg_output_tokens = 4000  # response

    gen_rates = MODEL_COSTS.get(gen_model, {"input": 3.0, "output": 15.0})
    aug_rates = MODEL_COSTS.get(aug_model, {"input": 0.80, "output": 4.0})

    gen_cost_per = (avg_input_tokens * gen_rates["input"] + avg_output_tokens * gen_rates["output"]) / 1_000_000
    aug_cost_per = (avg_input_tokens * aug_rates["input"] + avg_output_tokens * aug_rates["output"]) / 1_000_000

    # Strategy: generate `count` new, then augment each `multiplier` times
    total_new = count
    total_augmented = count * multiplier
    total_files = total_new + total_augmented

    gen_total = total_new * gen_cost_per
    aug_total = total_augmented * aug_cost_per
    total_cost = gen_total + aug_total

    avg_file_size_kb = 18  # from seed data analysis
    total_size_gb = (total_files * avg_file_size_kb) / (1024 * 1024)

    print(f"\n{'='*60}")
    print(f"COST ESTIMATE")
    print(f"{'='*60}")
    print(f"  New conversations:      {total_new:>10,}  @ ${gen_cost_per:.4f}/ea = ${gen_total:>10,.2f}")
    print(f"  Augmented copies:       {total_augmented:>10,}  @ ${aug_cost_per:.4f}/ea = ${aug_total:>10,.2f}")
    print(f"  {'─'*55}")
    print(f"  Total files:            {total_files:>10,}")
    print(f"  Total estimated cost:   {'':>10}    ${total_cost:>10,.2f}")
    print(f"  Estimated data size:    {total_size_gb:>10.1f} GB")
    print(f"{'='*60}")

    # Show path to 10GB
    if total_size_gb < 10:
        files_for_10gb = int(10 * 1024 * 1024 / avg_file_size_kb)
        # Optimal split: generate N new, augment 3x each
        optimal_new = files_for_10gb // (1 + multiplier)
        optimal_aug = optimal_new * multiplier
        optimal_cost = optimal_new * gen_cost_per + optimal_aug * aug_cost_per
        print(f"\n  To reach 10GB:")
        print(f"    Generate {optimal_new:,} new + {optimal_aug:,} augmented = {optimal_new + optimal_aug:,} files")
        print(f"    Estimated cost: ${optimal_cost:,.2f}")
    print()


# ============================================================
# CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Generate interview training data using Claude API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate 100 new conversations with 50 parallel calls
  python generate_training_data.py generate --count 100 --parallel 50

  # Augment all existing data 3x using Haiku (cheap)
  python generate_training_data.py augment --multiplier 3 --parallel 50

  # Estimate cost to generate 10,000 conversations
  python generate_training_data.py estimate --count 10000

  # Resume an interrupted batch
  python generate_training_data.py generate --count 1000 --resume --batch-id batch_1711843200
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Generate command
    gen_parser = subparsers.add_parser("generate", help="Generate new conversations")
    gen_parser.add_argument("--count", type=int, default=50, help="Number of conversations (default: 50)")
    gen_parser.add_argument("--parallel", type=int, default=30, help="Max parallel API calls (default: 30)")
    gen_parser.add_argument("--output", default="data/training/generated", help="Output directory")
    gen_parser.add_argument("--seed-dir", default="data/training/seed", help="Seed data directory for few-shot")
    gen_parser.add_argument("--model", default="claude-sonnet-4-20250514", help="Generation model")
    gen_parser.add_argument("--batch-id", default=None, help="Batch identifier (for resume)")
    gen_parser.add_argument("--resume", action="store_true", help="Resume interrupted batch")

    # Augment command
    aug_parser = subparsers.add_parser("augment", help="Augment existing conversations")
    aug_parser.add_argument("--multiplier", type=int, default=3, help="Variations per source file (default: 3)")
    aug_parser.add_argument("--parallel", type=int, default=50, help="Max parallel API calls (default: 50)")
    aug_parser.add_argument("--output", default="data/training/generated", help="Output directory")
    aug_parser.add_argument("--seed-dir", default="data/training/seed", help="Seed data directory")
    aug_parser.add_argument("--model", default="claude-haiku-4-5-20251001", help="Augmentation model")
    aug_parser.add_argument("--batch-id", default=None, help="Batch identifier")
    aug_parser.add_argument("--source-dirs", nargs="*", help="Additional source directories")

    # Estimate command
    est_parser = subparsers.add_parser("estimate", help="Estimate generation cost")
    est_parser.add_argument("--count", type=int, default=10000, help="Number of new conversations")
    est_parser.add_argument("--multiplier", type=int, default=3, help="Augmentation multiplier")

    # Backward compatibility: no subcommand = generate
    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    if args.command == "estimate":
        estimate_cost(args.count, args.multiplier)
        return

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: Set ANTHROPIC_API_KEY environment variable")
        print("  export ANTHROPIC_API_KEY='sk-ant-...'")
        sys.exit(1)

    if args.command == "generate":
        generator = AsyncTrainingDataGenerator(
            api_key=api_key,
            output_dir=args.output,
            gen_model=args.model,
            max_parallel=args.parallel,
            seed_dir=args.seed_dir,
        )
        asyncio.run(generator.generate_batch(
            count=args.count,
            batch_id=args.batch_id,
            resume=args.resume,
        ))

    elif args.command == "augment":
        generator = AsyncTrainingDataGenerator(
            api_key=api_key,
            output_dir=args.output,
            aug_model=args.model,
            max_parallel=args.parallel,
            seed_dir=args.seed_dir,
        )
        asyncio.run(generator.augment_batch(
            multiplier=args.multiplier,
            batch_id=args.batch_id,
            source_dirs=args.source_dirs,
        ))


if __name__ == "__main__":
    main()
