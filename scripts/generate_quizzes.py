#!/usr/bin/env python3
"""
Generate quiz bank JSON using Ollama.
Usage: python generate_quizzes.py --topic "consistent-hashing" --output content/tier-2/module-2.3-consistent-hashing/
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

QUIZ_PROMPT = """Generate 10 quiz questions for the system design topic: {topic_name}
Difficulty range: 4 at difficulty 1, 3 at difficulty 2, 3 at difficulty 3

Requirements per question:
- 4 options, exactly 1 correct (correct_answer is 0-based index)
- Detailed explanation (2-3 sentences)
- Questions must require UNDERSTANDING, not just memorization
- Include practical scenarios and trade-offs

Output ONLY valid JSON:
{{
  "topic_id": "{topic_slug}",
  "questions": [
    {{
      "id": "{topic_slug}_q001",
      "topic_id": "{topic_slug}",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 1,
      "explanation": "Detailed explanation...",
      "difficulty": 1,
      "tags": ["tag1", "tag2"]
    }}
  ]
}}"""


def generate_quiz(topic_name: str, topic_slug: str) -> dict | None:
    prompt = QUIZ_PROMPT.format(topic_name=topic_name, topic_slug=topic_slug)

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


def validate_quiz(data: dict) -> list[str]:
    errors = []
    questions = data.get("questions", [])
    if len(questions) < 5:
        errors.append(f"Only {len(questions)} questions (need at least 5)")

    for i, q in enumerate(questions):
        if len(q.get("options", [])) != 4:
            errors.append(f"Question {i} has {len(q.get('options', []))} options (need 4)")
        ca = q.get("correct_answer")
        if ca is None or not (0 <= ca <= 3):
            errors.append(f"Question {i} has invalid correct_answer: {ca}")

    return errors


def main():
    parser = argparse.ArgumentParser(description="Generate quiz bank via Ollama")
    parser.add_argument("--topic", required=True, help="Topic name (human readable)")
    parser.add_argument("--slug", help="Topic slug (default: derived from topic)")
    parser.add_argument("--output", required=True, help="Output directory")
    args = parser.parse_args()

    slug = args.slug or args.topic.lower().replace(" ", "-")
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating quiz for '{args.topic}' (slug: {slug})...")
    data = generate_quiz(args.topic, slug)

    if not data:
        print("Failed to generate quiz")
        sys.exit(1)

    errors = validate_quiz(data)
    if errors:
        print("Validation warnings:")
        for e in errors:
            print(f"  - {e}")

    output_path = output_dir / "quiz-bank.json"
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved to {output_path}")
    print(f"Questions: {len(data.get('questions', []))}")


if __name__ == "__main__":
    main()
