"""Authentication service — JWT tokens + password hashing."""
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext

from config import settings
from db.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


async def get_user_by_email(email: str) -> dict | None:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def get_user_by_id(user_id: int) -> dict | None:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, email, username, display_name, created_at FROM users WHERE id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def create_user(email: str, username: str, password: str) -> dict:
    db = await get_db()
    try:
        hashed = hash_password(password)
        cursor = await db.execute(
            "INSERT INTO users (email, username, password_hash, display_name) VALUES (?, ?, ?, ?)",
            (email, username, hashed, username),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "email": email, "username": username, "display_name": username}
    finally:
        await db.close()


async def get_or_create_oauth_user(email: str, display_name: str, provider: str) -> dict:
    """Find user by email or create a new one for OAuth login (no password needed)."""
    user = await get_user_by_email(email)
    if user:
        return {k: v for k, v in user.items() if k != "password_hash"}

    # Create new user — generate a username from email, use empty password hash (OAuth-only)
    base_username = email.split("@")[0]
    username = base_username
    db = await get_db()
    try:
        # Ensure unique username
        suffix = 0
        while True:
            cursor = await db.execute("SELECT id FROM users WHERE username = ?", (username,))
            if not await cursor.fetchone():
                break
            suffix += 1
            username = f"{base_username}{suffix}"

        cursor = await db.execute(
            "INSERT INTO users (email, username, password_hash, display_name) VALUES (?, ?, ?, ?)",
            (email, username, "", display_name or username),
        )
        await db.commit()
        return {"id": cursor.lastrowid, "email": email, "username": username, "display_name": display_name or username}
    finally:
        await db.close()
