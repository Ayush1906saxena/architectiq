import aiosqlite
from pathlib import Path

from config import settings

_db_initialized = False


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(settings.db_path)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    global _db_initialized
    if _db_initialized:
        return

    Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)

    schema_path = Path(__file__).parent / "init.sql"
    schema = schema_path.read_text()

    async with aiosqlite.connect(settings.db_path) as db:
        await db.executescript(schema)
        await db.commit()

    _db_initialized = True
