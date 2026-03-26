import json
from pathlib import Path
from datetime import datetime, timedelta

import aiosqlite

from config import settings
from models.quiz import QuizQuestion, QuizBank, MasteryUpdate
from services.ollama_client import ollama_client


class QuizService:
    def _find_quiz_bank_path(self, topic_id: str) -> Path | None:
        """Find the quiz-bank.json for a given topic."""
        content_dir = Path(settings.content_dir)
        for path in content_dir.rglob("quiz-bank.json"):
            if topic_id in str(path):
                return path
        return None

    async def get_quiz_bank(self, topic_id: str) -> QuizBank | None:
        path = self._find_quiz_bank_path(topic_id)
        if not path or not path.exists():
            return None
        with open(path) as f:
            data = json.load(f)
        return QuizBank(**data)

    async def submit_answer(
        self, topic_id: str, question_id: str, selected: int,
        correct: int, difficulty: int, time_ms: int
    ) -> MasteryUpdate:
        is_correct = selected == correct

        async with aiosqlite.connect(settings.db_path) as db:
            # Record result
            await db.execute(
                "INSERT INTO quiz_results (topic_id, question_id, user_answer, correct_answer, is_correct, difficulty, time_taken_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (topic_id, question_id, selected, correct, is_correct, difficulty, time_ms),
            )

            # Upsert topic mastery
            await db.execute("""
                INSERT INTO topic_mastery (topic_id, questions_attempted, questions_correct, current_difficulty, updated_at)
                VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(topic_id) DO UPDATE SET
                    questions_attempted = questions_attempted + 1,
                    questions_correct = questions_correct + CASE WHEN ? THEN 1 ELSE 0 END,
                    current_difficulty = ?,
                    updated_at = CURRENT_TIMESTAMP
            """, (topic_id, 1 if is_correct else 0, difficulty, is_correct, difficulty))

            # Get updated mastery
            cursor = await db.execute(
                "SELECT questions_attempted, questions_correct, current_difficulty FROM topic_mastery WHERE topic_id = ?",
                (topic_id,),
            )
            row = await cursor.fetchone()
            await db.commit()

        if row:
            attempted, correct_count, diff = row[0], row[1], row[2]
            mastery = correct_count / max(attempted, 1)
            badge = self._calculate_badge(mastery, diff)

            # Update badge and mastery level
            async with aiosqlite.connect(settings.db_path) as db:
                await db.execute(
                    "UPDATE topic_mastery SET mastery_level = ?, badge = ? WHERE topic_id = ?",
                    (mastery, badge, topic_id),
                )
                await db.commit()

            return MasteryUpdate(
                new_mastery=mastery,
                new_badge=badge if badge != "none" else None,
                difficulty_change=1 if is_correct else -1,
            )

        return MasteryUpdate(new_mastery=0.0, difficulty_change=0)

    async def get_adaptive_question(
        self, topic_id: str, difficulty: int, context: str = ""
    ) -> QuizQuestion | None:
        # For difficulty 1-3, use pre-generated bank
        if difficulty <= 3:
            bank = await self.get_quiz_bank(topic_id)
            if bank:
                matching = [q for q in bank.questions if q.difficulty <= difficulty]
                if matching:
                    import random
                    return random.choice(matching)

        # For difficulty 4+, use Ollama
        result = await ollama_client.generate_quiz_question(
            topic=topic_id.replace("-", " "),
            difficulty=difficulty,
            context=context,
        )
        if result:
            return QuizQuestion(
                id=f"adaptive_{topic_id}_{difficulty}",
                topic_id=topic_id,
                question=result.get("question", ""),
                options=result.get("options", ["A", "B", "C", "D"]),
                correct_answer=result.get("correct_answer", 0),
                explanation=result.get("explanation", ""),
                difficulty=difficulty,
                tags=result.get("tags", []),
            )
        return None

    def _calculate_badge(self, mastery: float, difficulty: int) -> str:
        if mastery >= 0.9 and difficulty >= 8:
            return "diamond"
        if mastery >= 0.75 and difficulty >= 6:
            return "gold"
        if mastery >= 0.5 and difficulty >= 4:
            return "silver"
        if mastery >= 0.3:
            return "bronze"
        return "none"


quiz_service = QuizService()
