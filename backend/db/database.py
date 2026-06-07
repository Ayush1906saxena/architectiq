import aiosqlite
from contextlib import asynccontextmanager
from pathlib import Path

from config import settings

_db_initialized = False


async def _configure(db: aiosqlite.Connection) -> None:
    """Per-connection pragmas: row dicts, sane concurrency, FK enforcement."""
    db.row_factory = aiosqlite.Row
    # WAL allows concurrent readers with a writer; busy_timeout makes writers wait
    # for a held lock instead of immediately raising "database is locked".
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA busy_timeout=5000")
    await db.execute("PRAGMA foreign_keys=ON")


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(settings.db_path)
    await _configure(db)
    return db


@asynccontextmanager
async def get_db_ctx():
    """Context-managed connection — preferred over get_db() + try/finally."""
    db = await get_db()
    try:
        yield db
    finally:
        await db.close()


# ── Migrations ────────────────────────────────────────────────
# Ordered, idempotent steps tracked by schema_version. Each entry is run once,
# in order, and recorded. Add new migrations to the end — never edit applied ones.

async def _column_exists(db, table: str, column: str) -> bool:
    cursor = await db.execute(f"PRAGMA table_info({table})")
    cols = [row["name"] for row in await cursor.fetchall()]
    return column in cols


async def _migration_transcript_json(db):
    if not await _column_exists(db, "interview_history", "transcript_json"):
        await db.execute("ALTER TABLE interview_history ADD COLUMN transcript_json TEXT")


async def _migration_indexes(db):
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_user ON interview_history(user_id)"
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_session ON interview_history(session_id)"
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_completed ON interview_history(completed_at)"
    )


# (version, callable). Versions must be strictly increasing.
_MIGRATIONS = [
    (1, _migration_transcript_json),
    (2, _migration_indexes),
]


async def _run_migrations(db) -> None:
    await db.execute(
        "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)"
    )
    await db.commit()
    cursor = await db.execute("SELECT MAX(version) AS v FROM schema_version")
    row = await cursor.fetchone()
    current = row["v"] or 0

    for version, migrate in _MIGRATIONS:
        if version > current:
            await migrate(db)
            await db.execute("INSERT INTO schema_version (version) VALUES (?)", (version,))
            await db.commit()


async def init_db():
    global _db_initialized
    if _db_initialized:
        return

    Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)

    schema_path = Path(__file__).parent / "init.sql"
    schema = schema_path.read_text()

    async with aiosqlite.connect(settings.db_path) as db:
        await _configure(db)
        await db.executescript(schema)
        await db.commit()
        await _run_migrations(db)

    _db_initialized = True
