#!/usr/bin/env python3
"""
Generate lesson content JSON using Ollama.
Usage: python generate_lessons.py --topic "Load Balancing" --tier 2 --output content/tier-2/module-2.2-load-balancing/L1-intro/
"""
import argparse
import json
import sys
from pathlib import Path

try:
    import httpx
except ImportError:
    print("pip install httpx")
    sys.exit(1)

OLLAMA_URL = "http://localhost:11434"
MODEL = "llama3.2"

LESSON_PROMPT = """You are creating lesson content for ArchitectIQ, a system design learning platform.
The AI teacher is "Prof. Arch" — a warm, rigorous professor who uses analogies
before formalism and always explains WHY before WHAT.

Generate a complete lesson script for:
Topic: {topic_name}
Tier: {tier} (0 = absolute beginner, 6 = expert)

The lesson must include:
1. 10-12 segments (each is a 15-60 second spoken chunk)
2. Each segment has: id, text, avatar_emotion, avatar_gesture, diagram_state, diagram_animations, pause_for_thought, thought_prompt, duration_ms
3. At least 2 "pause_for_thought" moments
4. At least 1 failure scenario
5. Analogies for every new concept
6. avatar_emotion options: idle_neutral, teach_explain, teach_point, emotion_excited, emotion_concerned, emotion_serious, interact_question
7. Each text should be 20-50 words of natural spoken narration

Output ONLY valid JSON matching this structure:
{{
  "topic_id": "topic-slug",
  "lesson_id": "L1-intro",
  "title": "Lesson Title",
  "description": "One sentence description",
  "segments": [
    {{
      "id": "seg_01_intro",
      "text": "Spoken narration text",
      "avatar_emotion": "teach_explain",
      "avatar_gesture": "gesture_open",
      "diagram_state": "empty",
      "diagram_animations": [],
      "pause_for_thought": false,
      "thought_prompt": null,
      "duration_ms": 10000
    }}
  ]
}}"""


def generate_lesson(topic: str, tier: int) -> dict | None:
    prompt = LESSON_PROMPT.format(topic_name=topic, tier=tier)

    try:
        resp = httpx.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.7},
            },
            timeout=120.0,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "")
        return json.loads(raw)
    except Exception as e:
        print(f"Error: {e}")
        return None


def validate_lesson(data: dict) -> list[str]:
    errors = []
    if "segments" not in data:
        errors.append("Missing 'segments' field")
        return errors

    segments = data["segments"]
    if len(segments) < 8:
        errors.append(f"Only {len(segments)} segments (need at least 8)")

    pause_count = sum(1 for s in segments if s.get("pause_for_thought"))
    if pause_count < 1:
        errors.append(f"Only {pause_count} pause_for_thought moments (need at least 1)")

    for i, seg in enumerate(segments):
        for field in ["id", "text", "avatar_emotion", "diagram_state"]:
            if not seg.get(field):
                errors.append(f"Segment {i} missing '{field}'")

    return errors


def main():
    parser = argparse.ArgumentParser(description="Generate lesson content via Ollama")
    parser.add_argument("--topic", required=True, help="Topic name")
    parser.add_argument("--tier", type=int, default=2, help="Tier level (0-6)")
    parser.add_argument("--output", required=True, help="Output directory")
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating lesson for '{args.topic}' (Tier {args.tier})...")
    data = generate_lesson(args.topic, args.tier)

    if not data:
        print("Failed to generate lesson")
        sys.exit(1)

    errors = validate_lesson(data)
    if errors:
        print("Validation warnings:")
        for e in errors:
            print(f"  - {e}")

    output_path = output_dir / "lesson.json"
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved to {output_path}")
    print(f"Segments: {len(data.get('segments', []))}")


if __name__ == "__main__":
    main()
