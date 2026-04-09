"""Adaptive recommendation endpoints."""
import json
from collections import defaultdict

from fastapi import APIRouter, Depends

from middleware.auth import get_current_user
from db.database import get_db

router = APIRouter()

DIMENSION_PROBLEMS = {
    "database_design": ["key-value-store", "chat-system", "url-shortener"],
    "caching_strategy": ["twitter-feed", "url-shortener", "video-streaming"],
    "scalability": ["ride-sharing", "twitter-feed", "search-engine"],
    "failure_handling": ["payment-system", "message-queue-design", "chat-system"],
    "api_design": ["rate-limiter", "url-shortener", "ride-sharing"],
    "capacity_estimation": ["video-streaming", "chat-system", "search-engine"],
    "requirements_gathering": ["ride-sharing", "payment-system", "chat-system"],
    "communication": ["payment-system", "search-engine", "video-streaming"],
}

LEVEL_ORDER = ["sde2", "senior", "staff", "principal", "vp"]


@router.get("/recommendations")
async def get_recommendations(user: dict = Depends(get_current_user)):
    """Analyze interview history and return personalized recommendations."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT career_level, overall_score, passed, scorecard_json "
            "FROM interview_history "
            "WHERE user_id = ? AND completed_at IS NOT NULL AND scorecard_json IS NOT NULL",
            (user["id"],),
        )
        rows = await cursor.fetchall()

        if not rows:
            return {
                "weak_dimensions": [],
                "suggested_level": None,
                "recommended_problems": [],
                "message": "Complete some interviews first to get personalised recommendations.",
            }

        # Aggregate dimension scores across all interviews
        dimension_totals: dict[str, list[float]] = defaultdict(list)
        levels_passed: dict[str, int] = defaultdict(int)
        levels_total: dict[str, int] = defaultdict(int)

        for row in rows:
            record = dict(row)
            try:
                scorecard = json.loads(record["scorecard_json"])
            except (json.JSONDecodeError, TypeError):
                continue

            level = record["career_level"]
            levels_total[level] += 1
            if record["passed"]:
                levels_passed[level] += 1

            # Extract dimension scores — try common scorecard shapes
            dim_scores = scorecard.get("dimension_scores") or scorecard.get("dimensions") or {}
            if isinstance(dim_scores, list):
                for entry in dim_scores:
                    name = entry.get("name") or entry.get("dimension", "")
                    score = entry.get("score")
                    if name and score is not None:
                        dimension_totals[name].append(float(score))
            elif isinstance(dim_scores, dict):
                for name, val in dim_scores.items():
                    if isinstance(val, (int, float)):
                        dimension_totals[name].append(float(val))
                    elif isinstance(val, dict) and "score" in val:
                        dimension_totals[name].append(float(val["score"]))

        # Calculate averages and find weakest dimensions
        dim_averages = {
            name: round(sum(scores) / len(scores), 1)
            for name, scores in dimension_totals.items()
            if scores
        }

        sorted_dims = sorted(dim_averages.items(), key=lambda x: x[1])
        weak_dimensions = []
        for name, avg in sorted_dims[:3]:
            problems = DIMENSION_PROBLEMS.get(name, [])
            weak_dimensions.append({
                "name": name,
                "avg_score": avg,
                "recommendation": f"Practice problems that test {name.replace('_', ' ')}: {', '.join(problems)}" if problems else f"Focus on improving {name.replace('_', ' ')}.",
            })

        # Suggest next level up if consistently passing at current level
        suggested_level = None
        for i, level in enumerate(LEVEL_ORDER):
            total = levels_total.get(level, 0)
            passed = levels_passed.get(level, 0)
            if total >= 2 and passed / total >= 0.7 and i + 1 < len(LEVEL_ORDER):
                suggested_level = LEVEL_ORDER[i + 1]

        # Collect recommended problems from weak dimensions (deduplicated, with reasons)
        seen = set()
        recommended_problems = []
        for dim in weak_dimensions:
            for pid in DIMENSION_PROBLEMS.get(dim["name"], []):
                if pid not in seen:
                    seen.add(pid)
                    recommended_problems.append({
                        "problem_id": pid,
                        "reason": f"Targets your weak area: {dim['name'].replace('_', ' ')}",
                    })

        return {
            "weak_dimensions": weak_dimensions,
            "suggested_level": suggested_level,
            "recommended_problems": recommended_problems,
        }
    finally:
        await db.close()
