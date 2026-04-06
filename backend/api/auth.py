"""Auth endpoints — signup, login, and current-user retrieval."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from services.auth_service import (
    get_user_by_email,
    create_user,
    verify_password,
    create_token,
)
from middleware.auth import get_current_user

router = APIRouter()


class SignupRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


@router.post("/auth/signup")
async def signup(req: SignupRequest):
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if len(req.username) < 2:
        raise HTTPException(400, "Username must be at least 2 characters")

    existing = await get_user_by_email(req.email)
    if existing:
        raise HTTPException(409, "Email already registered")

    # Check username uniqueness
    from db.database import get_db

    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM users WHERE username = ?", (req.username,))
        if await cursor.fetchone():
            raise HTTPException(409, "Username already taken")
    finally:
        await db.close()

    user = await create_user(req.email, req.username, req.password)
    token = create_token(user["id"])
    return AuthResponse(token=token, user=user)


@router.post("/auth/login")
async def login(req: LoginRequest):
    user = await get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    token = create_token(user["id"])
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return AuthResponse(token=token, user=safe_user)


@router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user
