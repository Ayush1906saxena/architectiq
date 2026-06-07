"""Tests for DB migrations and the leaderboard query."""
import aiosqlite
import pytest

import db.database as dbmod
from config import settings
from api import leaderboard


@pytest.fixture
async def temp_db(monkeypatch, tmp_path):
    path = str(tmp_path / "test.db")
    monkeypatch.setattr(settings, "db_path", path)
    monkeypatch.setattr(dbmod, "_db_initialized", False)
    await dbmod.init_db()
    return path


# ── Migrations ────────────────────────────────────────────────

async def test_schema_version_recorded(temp_db):
    async with aiosqlite.connect(temp_db) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT MAX(version) AS v FROM schema_version")
        assert (await cur.fetchone())["v"] == 2


async def test_indexes_created(temp_db):
    async with aiosqlite.connect(temp_db) as db:
        cur = await db.execute("SELECT name FROM sqlite_master WHERE type='index'")
        names = {r[0] for r in await cur.fetchall()}
    assert "idx_history_user" in names
    assert "idx_history_session" in names


async def test_init_is_idempotent(temp_db, monkeypatch):
    # Running init again must not error or double-apply migrations.
    monkeypatch.setattr(dbmod, "_db_initialized", False)
    await dbmod.init_db()
    async with aiosqlite.connect(temp_db) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute("SELECT COUNT(*) AS n FROM schema_version")
        assert (await cur.fetchone())["n"] == 2  # one row per migration, not duplicated


async def test_wal_enabled(temp_db):
    db = await dbmod.get_db()
    try:
        cur = await db.execute("PRAGMA journal_mode")
        assert (await cur.fetchone())[0].lower() == "wal"
    finally:
        await db.close()


# ── Leaderboard ───────────────────────────────────────────────

async def _seed(path):
    async with aiosqlite.connect(path) as db:
        await db.execute("INSERT INTO users (id, email, username, password_hash, display_name) VALUES (1,'a@x.com','alice','h','Alice')")
        await db.execute("INSERT INTO users (id, email, username, password_hash, display_name) VALUES (2,'b@x.com','bob','h','Bob')")
        # alice avg 90, bob avg 60
        for score in (80, 100):
            await db.execute("INSERT INTO interview_history (user_id, session_id, problem_id, career_level, overall_score, completed_at) VALUES (1,'s','p','senior',?,CURRENT_TIMESTAMP)", (score,))
        await db.execute("INSERT INTO interview_history (user_id, session_id, problem_id, career_level, overall_score, completed_at) VALUES (2,'s','p','senior',60,CURRENT_TIMESTAMP)")
        await db.execute("INSERT INTO user_streaks (user_id, current_streak, longest_streak) VALUES (1, 5, 9)")
        await db.commit()


async def test_leaderboard_ranks_in_sql(temp_db):
    await _seed(temp_db)
    board = await leaderboard.get_leaderboard()
    assert [e["username"] for e in board] == ["alice", "bob"]
    assert board[0]["rank"] == 1 and board[1]["rank"] == 2
    assert board[0]["avg_score"] == 90.0
    assert board[0]["current_streak"] == 5  # joined, not N+1


async def test_my_rank(temp_db):
    await _seed(temp_db)
    me = await leaderboard.get_my_rank({"id": 2, "username": "bob", "display_name": "Bob"})
    assert me["rank"] == 2
    assert me["total_users"] == 2
    assert me["avg_score"] == 60.0


async def test_my_rank_no_interviews(temp_db):
    await _seed(temp_db)
    me = await leaderboard.get_my_rank({"id": 99, "username": "newbie", "display_name": "New"})
    assert me["rank"] is None
    assert me["total_interviews"] == 0
