#!/usr/bin/env python3
"""
Validate all content JSON files in the content directory.
Usage: python validate_content.py
"""
import json
import sys
from pathlib import Path

CONTENT_DIR = Path(__file__).parent.parent / "content"

REQUIRED_LESSON_FIELDS = ["topic_id", "lesson_id", "title", "segments"]
REQUIRED_SEGMENT_FIELDS = ["id", "text", "avatar_emotion", "diagram_state"]
REQUIRED_QUIZ_FIELDS = ["topic_id", "questions"]
REQUIRED_QUESTION_FIELDS = ["id", "question", "options", "correct_answer", "explanation", "difficulty"]
VALID_EMOTIONS = ["idle_neutral", "teach_explain", "teach_point", "emotion_excited", "emotion_concerned", "emotion_serious", "interact_question"]


def validate_lesson(path: Path) -> list[str]:
    errors = []
    try:
        with open(path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return [f"Invalid JSON: {e}"]

    for field in REQUIRED_LESSON_FIELDS:
        if field not in data:
            errors.append(f"Missing field: {field}")

    segments = data.get("segments", [])
    if len(segments) < 5:
        errors.append(f"Only {len(segments)} segments (should be 8+)")

    for i, seg in enumerate(segments):
        for field in REQUIRED_SEGMENT_FIELDS:
            if not seg.get(field):
                errors.append(f"Segment {i} ({seg.get('id', '?')}): missing '{field}'")

        emotion = seg.get("avatar_emotion", "")
        if emotion and emotion not in VALID_EMOTIONS:
            errors.append(f"Segment {i}: unknown avatar_emotion '{emotion}'")

        duration = seg.get("duration_ms", 0)
        if duration < 2000 or duration > 60000:
            errors.append(f"Segment {i}: unusual duration {duration}ms")

    pause_count = sum(1 for s in segments if s.get("pause_for_thought"))
    if pause_count == 0:
        errors.append("No pause_for_thought segments")

    return errors


def validate_quiz(path: Path) -> list[str]:
    errors = []
    try:
        with open(path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return [f"Invalid JSON: {e}"]

    for field in REQUIRED_QUIZ_FIELDS:
        if field not in data:
            errors.append(f"Missing field: {field}")

    questions = data.get("questions", [])
    ids_seen = set()
    for i, q in enumerate(questions):
        for field in REQUIRED_QUESTION_FIELDS:
            if field not in q:
                errors.append(f"Question {i}: missing '{field}'")

        qid = q.get("id", "")
        if qid in ids_seen:
            errors.append(f"Question {i}: duplicate id '{qid}'")
        ids_seen.add(qid)

        opts = q.get("options", [])
        if len(opts) != 4:
            errors.append(f"Question {i}: {len(opts)} options (need 4)")

        ca = q.get("correct_answer")
        if ca is not None and not (0 <= ca <= 3):
            errors.append(f"Question {i}: invalid correct_answer {ca}")

    return errors


def validate_curriculum(path: Path) -> list[str]:
    errors = []
    try:
        with open(path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return [f"Invalid JSON: {e}"]

    for tier in data.get("tiers", []):
        for module in tier.get("modules", []):
            mod_path = CONTENT_DIR / module.get("path", "")
            if not mod_path.exists():
                errors.append(f"Module path doesn't exist: {module.get('path')}")

            for lesson in module.get("lessons", []):
                lesson_dir = CONTENT_DIR / lesson.get("path", "")
                lesson_json = lesson_dir / "lesson.json"
                if not lesson_json.exists():
                    errors.append(f"Lesson file missing: {lesson.get('path')}/lesson.json")

    return errors


def main():
    total_errors = 0

    # Validate curriculum
    curriculum = CONTENT_DIR / "curriculum.json"
    if curriculum.exists():
        errors = validate_curriculum(curriculum)
        if errors:
            print(f"\n{curriculum}:")
            for e in errors:
                print(f"  ERROR: {e}")
            total_errors += len(errors)
        else:
            print(f"OK: {curriculum}")

    # Validate all lessons
    for lesson_path in sorted(CONTENT_DIR.rglob("lesson.json")):
        errors = validate_lesson(lesson_path)
        if errors:
            print(f"\n{lesson_path.relative_to(CONTENT_DIR)}:")
            for e in errors:
                print(f"  ERROR: {e}")
            total_errors += len(errors)
        else:
            print(f"OK: {lesson_path.relative_to(CONTENT_DIR)}")

    # Validate all quiz banks
    for quiz_path in sorted(CONTENT_DIR.rglob("quiz-bank.json")):
        errors = validate_quiz(quiz_path)
        if errors:
            print(f"\n{quiz_path.relative_to(CONTENT_DIR)}:")
            for e in errors:
                print(f"  ERROR: {e}")
            total_errors += len(errors)
        else:
            print(f"OK: {quiz_path.relative_to(CONTENT_DIR)}")

    print(f"\n{'='*50}")
    print(f"Total errors: {total_errors}")
    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
