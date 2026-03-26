"""
Layer 1: Response Analyzer
Extracts structured meaning from candidate's text using LLM + keyword fallback.
"""
import json
import re
from services.ollama_client import ollama_client

# Known concepts across all system design problems
KNOWN_KEYWORDS = {
    # Databases
    "postgresql": "postgresql", "postgres": "postgresql", "mysql": "mysql",
    "dynamodb": "dynamodb", "cassandra": "cassandra", "mongodb": "mongodb",
    "redis": "redis", "memcached": "memcached", "sqlite": "sqlite",
    "cockroachdb": "cockroachdb", "spanner": "spanner", "hbase": "hbase",
    # Caching
    "cache": "caching", "lru": "lru_eviction", "lfu": "lfu_eviction",
    "ttl": "cache_ttl", "write-through": "write_through", "write-behind": "write_behind",
    "cache-aside": "cache_aside", "cdn": "cdn_caching",
    # Load Balancing
    "load balancer": "load_balancing", "nginx": "load_balancing",
    "round robin": "round_robin", "round-robin": "round_robin",
    "consistent hashing": "consistent_hashing", "hash ring": "consistent_hashing",
    "virtual nodes": "virtual_nodes", "vnodes": "virtual_nodes",
    # Messaging
    "kafka": "kafka", "rabbitmq": "rabbitmq", "sqs": "sqs",
    "message queue": "message_queue", "pub-sub": "pubsub", "pub/sub": "pubsub",
    "event sourcing": "event_sourcing", "cqrs": "cqrs",
    # Scaling
    "horizontal scaling": "horizontal_scaling", "vertical scaling": "vertical_scaling",
    "sharding": "sharding", "partition": "partitioning", "replication": "replication",
    "read replica": "read_replicas", "leader-follower": "leader_follower",
    # Encoding
    "base62": "base62_encoding", "base64": "base64_encoding",
    "base58": "base58_encoding", "md5": "md5_hashing", "sha": "sha_hashing",
    "uuid": "uuid_generation", "snowflake": "snowflake_id",
    # Networking
    "websocket": "websocket", "http": "http", "grpc": "grpc",
    "rest": "rest_api", "graphql": "graphql", "tcp": "tcp",
    # Patterns
    "circuit breaker": "circuit_breaker", "rate limit": "rate_limiting",
    "token bucket": "token_bucket", "sliding window": "sliding_window",
    "saga": "saga_pattern", "idempotency": "idempotency",
    "api gateway": "api_gateway", "reverse proxy": "reverse_proxy",
    # Infrastructure
    "docker": "docker", "kubernetes": "kubernetes", "k8s": "kubernetes",
    # Misc
    "cap theorem": "cap_theorem", "acid": "acid", "base": "base_properties",
    "eventual consistency": "eventual_consistency", "strong consistency": "strong_consistency",
    "geohash": "geohashing", "quadtree": "quadtree",
    "bloom filter": "bloom_filter", "merkle tree": "merkle_tree",
}

# Number patterns
NUMBER_PATTERN = re.compile(
    r'(\d+(?:\.\d+)?)\s*(?:million|mil|M|billion|bil|B|thousand|K|hundred|%|'
    r'ms|millisecond|second|sec|minute|min|hour|hr|day|'
    r'MB|GB|TB|PB|KB|'
    r'QPS|qps|RPS|rps|TPS|tps|'
    r'users|requests|queries|connections|servers|nodes|instances|replicas|partitions)',
    re.IGNORECASE
)

DECISION_PATTERNS = [
    re.compile(r"(?:i(?:'d| would)|we (?:can|could|should)|let'?s) use (\w[\w\s]*?)(?:\.|,|because|for|$)", re.I),
    re.compile(r"(?:i(?:'d| would)|we should) (?:go with|pick|choose) (\w[\w\s]*?)(?:\.|,|$)", re.I),
    re.compile(r"(\w[\w\s]*?) (?:is|would be) (?:a good|the best|the right) (?:choice|option|fit)", re.I),
]

REASONING_SIGNALS = [
    "because", "since", "the reason", "trade-off", "tradeoff", "trade off",
    "downside", "advantage", "disadvantage", "pro ", "con ", "alternatively",
    "compared to", "instead of", "rather than", "on the other hand",
    "the problem with", "the issue", "the benefit",
]

FAILURE_SIGNALS = [
    "fail", "crash", "goes down", "dies", "outage", "partition",
    "timeout", "retry", "fallback", "graceful degradation", "circuit breaker",
    "single point of failure", "spof", "redundan", "fault toleran",
    "disaster recovery", "failover", "backup",
]


class ResponseAnalysis:
    def __init__(self):
        self.concepts_mentioned: list[str] = []
        self.claims: list[dict] = []
        self.numbers: list[dict] = []
        self.decisions: list[dict] = []
        self.depth_signals = {
            "gave_reasoning": False,
            "mentioned_tradeoffs": False,
            "used_specific_numbers": False,
            "referenced_alternatives": False,
            "discussed_failure_modes": False,
        }

    def to_dict(self):
        return {
            "concepts_mentioned": self.concepts_mentioned,
            "claims": self.claims,
            "numbers": self.numbers,
            "decisions": self.decisions,
            "depth_signals": self.depth_signals,
        }


class ResponseAnalyzer:
    async def analyze(self, text: str, problem_id: str = "") -> ResponseAnalysis:
        """Analyze candidate response. Uses keyword extraction + LLM enrichment."""
        result = self._keyword_analysis(text)

        # Try LLM enrichment for better extraction
        llm_result = await self._llm_analysis(text)
        if llm_result:
            self._merge_llm_result(result, llm_result)

        return result

    def _keyword_analysis(self, text: str) -> ResponseAnalysis:
        """Fast keyword-based analysis. Always works, no LLM needed."""
        result = ResponseAnalysis()
        text_lower = text.lower()

        # Extract concepts
        for keyword, concept_id in KNOWN_KEYWORDS.items():
            if keyword in text_lower and concept_id not in result.concepts_mentioned:
                result.concepts_mentioned.append(concept_id)

        # Extract numbers
        for match in NUMBER_PATTERN.finditer(text):
            result.numbers.append({
                "raw": match.group(0),
                "value": match.group(1),
                "context": text[max(0, match.start() - 30):match.end() + 30].strip(),
            })

        # Extract decisions
        for pattern in DECISION_PATTERNS:
            for match in pattern.finditer(text):
                choice = match.group(1).strip()
                # Find reasoning (text after "because" etc)
                reasoning = ""
                for signal in ["because", "since", "as it", "for its"]:
                    idx = text_lower.find(signal, match.end())
                    if idx != -1 and idx < match.end() + 200:
                        end = text.find(".", idx)
                        reasoning = text[idx:end if end != -1 else idx + 150].strip()
                        break

                result.decisions.append({
                    "choice": choice,
                    "reasoning": reasoning,
                    "has_reasoning": bool(reasoning),
                })
                result.claims.append({
                    "claim": f"Would use {choice}",
                    "type": "design_choice",
                    "concept": self._match_concept(choice),
                    "justified": bool(reasoning),
                })

        # Depth signals
        result.depth_signals["gave_reasoning"] = any(
            s in text_lower for s in REASONING_SIGNALS
        )
        result.depth_signals["mentioned_tradeoffs"] = any(
            s in text_lower for s in ["trade-off", "tradeoff", "trade off", "downside",
                                       "alternatively", "on the other hand", "compared to"]
        )
        result.depth_signals["used_specific_numbers"] = len(result.numbers) > 0
        result.depth_signals["referenced_alternatives"] = any(
            s in text_lower for s in ["instead of", "rather than", "alternatively",
                                       "another option", "we could also", "compared to"]
        )
        result.depth_signals["discussed_failure_modes"] = any(
            s in text_lower for s in FAILURE_SIGNALS
        )

        return result

    def _match_concept(self, text: str) -> str:
        """Match a piece of text to a known concept."""
        text_lower = text.lower().strip()
        for keyword, concept_id in KNOWN_KEYWORDS.items():
            if keyword in text_lower:
                return concept_id
        return text_lower.replace(" ", "_")

    async def _llm_analysis(self, text: str) -> dict | None:
        """Use LLM for richer extraction. Falls back gracefully."""
        prompt = (
            "Extract technical content from this system design interview response.\n"
            "Respond ONLY with valid JSON:\n"
            "{\n"
            '  "components": ["list of technologies/components mentioned"],\n'
            '  "claims": [{"claim": "what they stated", "concept": "related_concept"}],\n'
            '  "is_asking_question": false\n'
            "}\n\n"
            f'Candidate said: "{text}"'
        )

        try:
            raw = await ollama_client.generate(prompt, json_mode=True, temperature=0.1)
            return json.loads(raw)
        except Exception:
            return None

    def _merge_llm_result(self, result: ResponseAnalysis, llm: dict):
        """Merge LLM extractions into keyword results."""
        for component in llm.get("components", []):
            concept = self._match_concept(component)
            if concept and concept not in result.concepts_mentioned:
                result.concepts_mentioned.append(concept)

        for claim in llm.get("claims", []):
            if claim.get("claim"):
                result.claims.append({
                    "claim": claim["claim"],
                    "type": "assertion",
                    "concept": claim.get("concept", ""),
                    "justified": False,
                })


response_analyzer = ResponseAnalyzer()
