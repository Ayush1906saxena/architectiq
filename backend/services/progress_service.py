from datetime import datetime, timedelta

import aiosqlite

from config import settings
from models.progress import TopicMastery, LessonProgressItem, ProgressSummary


class ProgressService:
    async def get_all_progress(self) -> ProgressSummary:
        async with aiosqlite.connect(settings.db_path) as db:
            db.row_factory = aiosqlite.Row

            # Topic masteries
            cursor = await db.execute("SELECT * FROM topic_mastery")
            mastery_rows = await cursor.fetchall()
            topics = [
                TopicMastery(
                    topic_id=r["topic_id"],
                    mastery_level=r["mastery_level"],
                    badge=r["badge"],
                    questions_attempted=r["questions_attempted"],
                    questions_correct=r["questions_correct"],
                    current_difficulty=r["current_difficulty"],
                    next_review_at=r["next_review_at"],
                )
                for r in mastery_rows
            ]

            # Lesson progress
            cursor = await db.execute("SELECT * FROM lesson_progress")
            lesson_rows = await cursor.fetchall()
            lessons = [
                LessonProgressItem(
                    topic_id=r["topic_id"],
                    lesson_id=r["lesson_id"],
                    completed=bool(r["completed"]),
                    last_segment_index=r["last_segment_index"],
                )
                for r in lesson_rows
            ]

            completed_count = sum(1 for l in lessons if l.completed)

            # Total quizzes
            cursor = await db.execute("SELECT COUNT(*) FROM quiz_results")
            quiz_count = (await cursor.fetchone())[0]

        return ProgressSummary(
            topics=topics,
            lessons=lessons,
            total_lessons_completed=completed_count,
            total_quizzes_taken=quiz_count,
        )

    async def get_topic_mastery(self, topic_id: str) -> TopicMastery:
        async with aiosqlite.connect(settings.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM topic_mastery WHERE topic_id = ?", (topic_id,)
            )
            row = await cursor.fetchone()

        if row:
            return TopicMastery(
                topic_id=row["topic_id"],
                mastery_level=row["mastery_level"],
                badge=row["badge"],
                questions_attempted=row["questions_attempted"],
                questions_correct=row["questions_correct"],
                current_difficulty=row["current_difficulty"],
                next_review_at=row["next_review_at"],
            )
        return TopicMastery(topic_id=topic_id)

    async def get_review_queue(self) -> list[TopicMastery]:
        now = datetime.utcnow().isoformat()
        async with aiosqlite.connect(settings.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM topic_mastery WHERE next_review_at IS NOT NULL AND next_review_at <= ? ORDER BY next_review_at ASC",
                (now,),
            )
            rows = await cursor.fetchall()

        return [
            TopicMastery(
                topic_id=r["topic_id"],
                mastery_level=r["mastery_level"],
                badge=r["badge"],
                questions_attempted=r["questions_attempted"],
                questions_correct=r["questions_correct"],
                current_difficulty=r["current_difficulty"],
                next_review_at=r["next_review_at"],
            )
            for r in rows
        ]

    async def update_review_schedule(self, topic_id: str, quality: int):
        """Update SM-2 spaced repetition schedule. quality: 0-5."""
        async with aiosqlite.connect(settings.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT easiness_factor, interval_days, repetitions FROM topic_mastery WHERE topic_id = ?",
                (topic_id,),
            )
            row = await cursor.fetchone()

            if not row:
                return

            ef = row["easiness_factor"]
            interval = row["interval_days"]
            reps = row["repetitions"]

            # SM-2 algorithm
            if quality >= 3:
                if reps == 0:
                    interval = 1
                elif reps == 1:
                    interval = 6
                else:
                    interval = int(interval * ef)
                reps += 1
            else:
                reps = 0
                interval = 1

            ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
            ef = max(1.3, ef)

            next_review = (datetime.utcnow() + timedelta(days=interval)).isoformat()

            await db.execute(
                "UPDATE topic_mastery SET easiness_factor = ?, interval_days = ?, repetitions = ?, next_review_at = ?, last_reviewed_at = CURRENT_TIMESTAMP WHERE topic_id = ?",
                (ef, interval, reps, next_review, topic_id),
            )
            await db.commit()


progress_service = ProgressService()
