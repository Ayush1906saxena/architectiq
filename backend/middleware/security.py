"""
Security middleware for ArchitectIQ.
Handles rate limiting, request size limits, and input sanitization.
"""
import re
import time
from dataclasses import dataclass
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


def _client_key(request: Request) -> str:
    """Identify the client for rate limiting.

    Behind a reverse proxy / load balancer the socket peer is the proxy, so honor
    the leftmost X-Forwarded-For entry when present (the original client).
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


# ── Rate Limiter ──────────────────────────────────────────────

@dataclass
class _RateBucket:
    tokens: float
    last_refill: float


class RateLimiter:
    """Token-bucket rate limiter keyed by client IP."""

    def __init__(self, requests_per_minute: int = 30, burst: int = 10):
        self._rate = requests_per_minute / 60.0  # tokens per second
        self._burst = burst
        self._buckets: dict[str, _RateBucket] = {}
        self._last_cleanup = time.monotonic()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        self._maybe_cleanup(now)

        bucket = self._buckets.get(key)
        if bucket is None:
            bucket = _RateBucket(tokens=self._burst - 1, last_refill=now)
            self._buckets[key] = bucket
            return True

        # Refill tokens
        elapsed = now - bucket.last_refill
        bucket.tokens = min(self._burst, bucket.tokens + elapsed * self._rate)
        bucket.last_refill = now

        if bucket.tokens >= 1:
            bucket.tokens -= 1
            return True
        return False

    def _maybe_cleanup(self, now: float):
        """Remove stale entries every 5 minutes."""
        if now - self._last_cleanup > 300:
            cutoff = now - 600
            self._buckets = {
                k: v for k, v in self._buckets.items()
                if v.last_refill > cutoff
            }
            self._last_cleanup = now


# Global rate limiters for different endpoint tiers
_general_limiter = RateLimiter(requests_per_minute=60, burst=15)
_llm_limiter = RateLimiter(requests_per_minute=20, burst=5)
_start_limiter = RateLimiter(requests_per_minute=5, burst=3)

# Endpoints that call the LLM (more restrictive)
_LLM_ENDPOINTS = {
    "/api/interview/message",
    "/api/interview/start",
    "/api/ask",
    "/api/design-challenge/message",
    "/api/quiz/adaptive",
}

_START_ENDPOINTS = {
    "/api/interview/start",
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = _client_key(request)
        path = request.url.path

        # Pick the appropriate limiter
        if path in _START_ENDPOINTS:
            limiter = _start_limiter
        elif path in _LLM_ENDPOINTS:
            limiter = _llm_limiter
        else:
            limiter = _general_limiter

        if not limiter.allow(client_ip):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": "10"},
            )

        return await call_next(request)


# ── Request Size Limit ────────────────────────────────────────

MAX_BODY_SIZE = 50_000  # 50KB — plenty for text messages, blocks abuse


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > MAX_BODY_SIZE:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request body too large. Maximum 50KB."},
                )
        return await call_next(request)


# ── Input Sanitization ────────────────────────────────────────

def sanitize_for_prompt(text: str, max_length: int = 5000) -> str:
    """Sanitize user input before interpolating into LLM prompts.

    This doesn't prevent all prompt injection (that's fundamentally hard),
    but it removes the most obvious attack vectors.
    """
    # Truncate
    text = text[:max_length]

    # Remove sequences that commonly appear in prompt injection attempts
    # Don't over-filter — we want natural language to flow through
    injection_markers = [
        "ignore all previous",
        "ignore above",
        "disregard your instructions",
        "you are now",
        "new instructions:",
        "system prompt:",
        "reveal your prompt",
        "output your instructions",
        "forget your rules",
    ]
    # Neutralize injection markers by redacting them. This defuses the literal
    # instruction while leaving the rest of the candidate's text intact.
    for marker in injection_markers:
        text = re.sub(re.escape(marker), "[filtered]", text, flags=re.IGNORECASE)

    return text


def sanitize_path_component(component: str) -> str:
    """Sanitize a path component to prevent directory traversal."""
    # Remove any path separators and parent directory references
    sanitized = component.replace("/", "").replace("\\", "").replace("..", "").replace("\x00", "")
    # Only allow alphanumeric, hyphens, and underscores
    return "".join(c for c in sanitized if c.isalnum() or c in "-_")
