"""
Layer 1: Response Analyzer
Extracts structured meaning from candidate's text.

Primary: LLM-powered structured extraction that actually understands what the candidate said.
Fallback: Keyword-based analysis when LLM is unavailable.

The LLM call returns per-concept depth assessment, specific claims, reasoning gaps,
and a suggested follow-up question — all in one call to minimize latency.
"""
import json
import re
from pathlib import Path

from config import settings
from services.ollama_client import ollama_client
from middleware.security import sanitize_for_prompt

# ── Keyword fallback data (used when LLM is unavailable) ─────

KNOWN_KEYWORDS = {
    "postgresql": "postgresql", "postgres": "postgresql", "mysql": "mysql",
    "dynamodb": "dynamodb", "cassandra": "cassandra", "mongodb": "mongodb",
    "redis": "redis", "memcached": "memcached", "sqlite": "sqlite",
    "cockroachdb": "cockroachdb", "spanner": "spanner", "hbase": "hbase",
    "cache": "caching", "lru": "lru_eviction", "lfu": "lfu_eviction",
    "ttl": "cache_ttl", "write-through": "write_through", "write-behind": "write_behind",
    "cache-aside": "cache_aside", "cdn": "cdn_caching",
    "load balancer": "load_balancing", "nginx": "load_balancing",
    "consistent hashing": "consistent_hashing", "hash ring": "consistent_hashing",
    "virtual nodes": "virtual_nodes", "vnodes": "virtual_nodes",
    "kafka": "kafka", "rabbitmq": "rabbitmq", "sqs": "sqs",
    "message queue": "message_queue", "pub-sub": "pubsub", "pub/sub": "pubsub",
    "event sourcing": "event_sourcing", "cqrs": "cqrs",
    "horizontal scaling": "horizontal_scaling", "vertical scaling": "vertical_scaling",
    "sharding": "sharding", "partition": "partitioning", "replication": "replication",
    "read replica": "read_replicas", "leader-follower": "leader_follower",
    "base62": "base62_encoding", "base64": "base64_encoding",
    "md5": "md5_hashing", "sha": "sha_hashing",
    "uuid": "uuid_generation", "snowflake": "snowflake_id",
    "websocket": "websocket", "http": "http", "grpc": "grpc",
    "rest": "rest_api", "graphql": "graphql",
    "circuit breaker": "circuit_breaker", "rate limit": "rate_limiting",
    "token bucket": "token_bucket", "sliding window": "sliding_window",
    "saga": "saga_pattern", "idempotency": "idempotency",
    "api gateway": "api_gateway", "reverse proxy": "reverse_proxy",
    "cap theorem": "cap_theorem", "acid": "acid",
    "eventual consistency": "eventual_consistency", "strong consistency": "strong_consistency",
    "geohash": "geohashing", "quadtree": "quadtree",
    "bloom filter": "bloom_filter", "merkle tree": "merkle_tree",
}

NUMBER_PATTERN = re.compile(
    r'(\d+(?:\.\d+)?)\s*(?:million|mil|M|billion|bil|B|thousand|K|hundred|%|'
    r'ms|millisecond|second|sec|minute|min|hour|hr|day|'
    r'MB|GB|TB|PB|KB|'
    r'QPS|qps|RPS|rps|TPS|tps|'
    r'users|requests|queries|connections|servers|nodes|instances|replicas|partitions)',
    re.IGNORECASE
)

# Phrases that signal the candidate has given up. Checked as substrings, so these
# must be specific enough not to match inside real answers (e.g. "no" would match
# "nosql"). Bare one-word give-ups are matched exactly via STUCK_EXACT instead.
STUCK_PHRASES = [
    "i don't know", "i dont know", "not sure", "no idea",
    "i'm not sure", "im not sure", "i have no idea",
    "can you help", "give me a hint", "i'm stuck", "im stuck",
]
STUCK_EXACT = {"no", "nope", "skip", "next", "pass", "idk"}


def _is_explicit_stuck(text_lower: str) -> bool:
    """True only for unambiguous give-up answers — never for terse technical ones."""
    if text_lower in STUCK_EXACT:
        return True
    return any(phrase in text_lower for phrase in STUCK_PHRASES)

# ── LLM Analysis Prompt ──────────────────────────────────────

_ANALYSIS_SYSTEM = """You are an expert system design interview evaluator. Your job is to analyze a candidate's response and extract structured information.

You must respond with ONLY valid JSON. No markdown, no code fences, no explanation outside the JSON.

Be precise and honest in your depth assessments:
- "none": They didn't address this concept at all
- "buzzword": They named a technology but showed no understanding (e.g., "I'd use Kafka" with no reasoning)
- "surface": Basic correct understanding but no depth (e.g., "Kafka is a message queue for async processing")
- "applied": Shows practical understanding with reasoning, numbers, or trade-offs (e.g., "Kafka because we need ordering per partition key, and at 1M msgs/sec we'd need ~10 partitions")
- "deep": Demonstrates internals, failure modes, or production experience (e.g., "Kafka's ISR replication with acks=all gives us durability, but if ISR shrinks to just the leader we risk data loss — that's why we set min.insync.replicas=2")

Be strict. Most responses are "surface" or "applied". "Deep" is rare and requires genuine insight."""


def _build_analysis_prompt(text: str, problem_id: str, knowledge_graph: dict) -> str:
    """Build the analysis prompt with problem context."""
    # Get concept names from knowledge graph for context
    concepts = knowledge_graph.get("concepts", {})
    concept_list = [
        f"- {cid}: {cdata.get('name', cid)}"
        for cid, cdata in concepts.items()
    ]
    concept_context = "\n".join(concept_list[:25])  # Cap to avoid token bloat

    return f"""Analyze this system design interview response for the problem: {problem_id}

KNOWN CONCEPTS FOR THIS PROBLEM:
{concept_context}

CANDIDATE'S RESPONSE:
\"\"\"{sanitize_for_prompt(text)}\"\"\"

Respond with this exact JSON structure:
{{
  "concepts": [
    {{
      "id": "concept_id_from_list_above",
      "depth": "none|buzzword|surface|applied|deep",
      "summary": "one sentence describing what they said about this concept"
    }}
  ],
  "claims": [
    {{
      "text": "the specific claim they made",
      "concept": "related_concept_id",
      "justified": true/false,
      "reasoning_given": "their reasoning if any, or empty string"
    }}
  ],
  "has_numbers": true/false,
  "has_tradeoffs": true/false,
  "has_failure_discussion": true/false,
  "overall_depth": "buzzword|surface|applied|deep",
  "gaps": ["specific thing they should have addressed but didn't"],
  "suggested_followup": "A specific follow-up question based on the weakest part of their answer. Reference what they actually said.",
  "is_asking_question": true/false,
  "is_stuck": true/false
}}

IMPORTANT:
- Only include concepts they ACTUALLY discussed. Don't infer concepts they didn't mention.
- "suggested_followup" should be a question a real interviewer would ask based on THIS specific response. Not generic.
- "gaps" should be things relevant to what they were discussing, not a wish list of everything they could have said.
- If the response is very short or says "I don't know", set is_stuck=true and keep concepts list empty."""


# ── Response Analysis Result ──────────────────────────────────

class ResponseAnalysis:
    def __init__(self):
        self.concepts_mentioned: list[str] = []
        self.concept_depths: dict[str, str] = {}     # concept_id → depth string
        self.concept_summaries: dict[str, str] = {}   # concept_id → what they said
        self.claims: list[dict] = []
        self.numbers: list[dict] = []
        self.depth_signals = {
            "gave_reasoning": False,
            "mentioned_tradeoffs": False,
            "used_specific_numbers": False,
            "referenced_alternatives": False,
            "discussed_failure_modes": False,
        }
        self.overall_depth: str = "surface"
        self.gaps: list[str] = []
        self.suggested_followup: str = ""
        self.is_stuck: bool = False
        self.is_short_answer: bool = False
        self.is_asking_question: bool = False

    def to_dict(self):
        return {
            "concepts_mentioned": self.concepts_mentioned,
            "concept_depths": self.concept_depths,
            "concept_summaries": self.concept_summaries,
            "claims": self.claims,
            "numbers": self.numbers,
            "depth_signals": self.depth_signals,
            "overall_depth": self.overall_depth,
            "gaps": self.gaps,
            "suggested_followup": self.suggested_followup,
            "is_stuck": self.is_stuck,
            "is_short_answer": self.is_short_answer,
            "is_asking_question": self.is_asking_question,
        }


# ── Knowledge Graph Cache ─────────────────────────────────────

_kg_cache: dict[str, dict] = {}

def _get_knowledge_graph(problem_id: str) -> dict:
    """Load and cache knowledge graph for a problem."""
    if problem_id not in _kg_cache:
        path = Path(settings.content_dir) / "knowledge-graphs" / f"{problem_id}.json"
        if path.exists():
            with open(path) as f:
                _kg_cache[problem_id] = json.load(f)
        else:
            _kg_cache[problem_id] = {"concepts": {}}
    return _kg_cache[problem_id]


# ── Analyzer ──────────────────────────────────────────────────

class ResponseAnalyzer:
    async def analyze(self, text: str, problem_id: str = "") -> ResponseAnalysis:
        """Analyze candidate response. LLM-first with keyword fallback."""
        result = ResponseAnalysis()
        text_stripped = text.strip()
        text_lower = text_stripped.lower()

        # Quick checks that don't need LLM
        result.is_short_answer = len(text_stripped.split()) < 5
        result.is_asking_question = text_stripped.endswith("?")

        # Only short-circuit on an unambiguous give-up. Ambiguous short answers
        # (e.g. "Shard by user_id") are sent to the LLM, which assesses is_stuck in
        # context rather than guessing from word count alone.
        if _is_explicit_stuck(text_lower):
            result.is_stuck = True
            return result

        # Extract numbers (always useful, fast)
        for match in NUMBER_PATTERN.finditer(text):
            result.numbers.append({
                "raw": match.group(0),
                "value": match.group(1),
                "context": text[max(0, match.start() - 30):match.end() + 30].strip(),
            })

        # Try LLM analysis (primary path)
        kg = _get_knowledge_graph(problem_id) if problem_id else {"concepts": {}}
        llm_result = await self._llm_analysis(text, problem_id, kg)

        if llm_result:
            self._apply_llm_result(result, llm_result)
        else:
            # Fallback to keyword analysis
            self._keyword_fallback(result, text_lower)

        return result

    async def _llm_analysis(self, text: str, problem_id: str, kg: dict) -> dict | None:
        """Primary analysis path: structured LLM extraction.

        Returns None when the LLM is unavailable or the output is unusable, so the
        caller falls back to keyword analysis.
        """
        prompt = _build_analysis_prompt(text, problem_id, kg)
        parsed = await ollama_client.generate_json(
            prompt,
            system=_ANALYSIS_SYSTEM,
            temperature=0.1,
            max_tokens=1024,
        )

        # Basic validation — must be an object with a concepts list
        if not isinstance(parsed, dict) or not isinstance(parsed.get("concepts"), list):
            return None
        return parsed

    def _apply_llm_result(self, result: ResponseAnalysis, llm: dict):
        """Apply LLM analysis to the result object."""
        # Concepts with per-concept depth
        for concept in llm.get("concepts", []):
            cid = concept.get("id", "")
            depth = concept.get("depth", "surface")
            if cid and depth != "none":
                result.concepts_mentioned.append(cid)
                result.concept_depths[cid] = depth
                result.concept_summaries[cid] = concept.get("summary", "")

        # Claims
        for claim in llm.get("claims", []):
            if claim.get("text"):
                result.claims.append({
                    "claim": claim["text"],
                    "type": "design_choice",
                    "concept": claim.get("concept", ""),
                    "justified": claim.get("justified", False),
                    "reasoning": claim.get("reasoning_given", ""),
                })

        # Depth signals (from LLM assessment, not pattern matching)
        result.depth_signals["used_specific_numbers"] = llm.get("has_numbers", False) or len(result.numbers) > 0
        result.depth_signals["mentioned_tradeoffs"] = llm.get("has_tradeoffs", False)
        result.depth_signals["discussed_failure_modes"] = llm.get("has_failure_discussion", False)
        result.depth_signals["gave_reasoning"] = any(c.get("justified") for c in llm.get("claims", []))
        result.depth_signals["referenced_alternatives"] = result.depth_signals["mentioned_tradeoffs"]

        # Overall depth from LLM
        result.overall_depth = llm.get("overall_depth", "surface")

        # Gaps and follow-up
        result.gaps = llm.get("gaps", [])[:3]  # Cap at 3
        result.suggested_followup = llm.get("suggested_followup", "")

        # Question + stuck detection from LLM (authoritative for ambiguous answers).
        # OR with the punctuation heuristic so "How many users" still counts.
        result.is_asking_question = result.is_asking_question or bool(llm.get("is_asking_question"))
        if llm.get("is_stuck"):
            result.is_stuck = True

    def _keyword_fallback(self, result: ResponseAnalysis, text_lower: str):
        """Fallback analysis using keyword matching. Used when LLM is unavailable."""
        # Extract concepts
        for keyword, concept_id in KNOWN_KEYWORDS.items():
            if keyword in text_lower and concept_id not in result.concepts_mentioned:
                result.concepts_mentioned.append(concept_id)
                result.concept_depths[concept_id] = "surface"  # Can't assess depth without LLM

        # Depth signals from patterns
        reasoning_signals = [
            "because", "since", "the reason", "trade-off", "tradeoff",
            "downside", "advantage", "disadvantage", "alternatively",
            "compared to", "instead of", "rather than", "on the other hand",
        ]
        failure_signals = [
            "fail", "crash", "goes down", "dies", "outage", "timeout",
            "retry", "fallback", "graceful degradation", "circuit breaker",
            "single point of failure", "spof", "failover",
        ]

        result.depth_signals["gave_reasoning"] = any(s in text_lower for s in reasoning_signals)
        result.depth_signals["mentioned_tradeoffs"] = any(
            s in text_lower for s in ["trade-off", "tradeoff", "downside", "alternatively", "compared to"]
        )
        result.depth_signals["used_specific_numbers"] = len(result.numbers) > 0
        result.depth_signals["referenced_alternatives"] = any(
            s in text_lower for s in ["instead of", "rather than", "alternatively", "another option"]
        )
        result.depth_signals["discussed_failure_modes"] = any(s in text_lower for s in failure_signals)

        # Estimate overall depth from signals
        signal_count = sum(1 for v in result.depth_signals.values() if v)
        if signal_count == 0:
            result.overall_depth = "buzzword"
        elif signal_count == 1:
            result.overall_depth = "surface"
        elif signal_count <= 3:
            result.overall_depth = "applied"
        else:
            result.overall_depth = "deep"

        # Without the LLM, a short answer that surfaced no known concept is our best
        # signal that the candidate is stuck.
        if result.is_short_answer and not result.concepts_mentioned:
            result.is_stuck = True


response_analyzer = ResponseAnalyzer()
