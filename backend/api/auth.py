"""Auth endpoints — signup, login, OAuth (Google/GitHub), and current-user retrieval."""
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from config import settings
from services.auth_service import (
    get_user_by_email,
    create_user,
    verify_password,
    create_token,
    get_or_create_oauth_user,
)
from middleware.auth import get_current_user

router = APIRouter()

# In-memory state store for CSRF protection (fine for single-process)
_oauth_states: dict[str, str] = {}


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


# ── Email/Password Auth ─────────────────────────────────────

@router.post("/auth/signup")
async def signup(req: SignupRequest):
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if len(req.username) < 2:
        raise HTTPException(400, "Username must be at least 2 characters")

    existing = await get_user_by_email(req.email)
    if existing:
        raise HTTPException(409, "Email already registered")

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
    if not user or not user.get("password_hash") or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    token = create_token(user["id"])
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return AuthResponse(token=token, user=safe_user)


@router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


# ── Google OAuth ─────────────────────────────────────────────

@router.get("/auth/google")
async def google_login():
    """Redirect user to Google's OAuth consent screen."""
    if not settings.google_client_id:
        raise HTTPException(501, "Google OAuth not configured")

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = "google"

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": f"{settings.frontend_url}/api/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@router.get("/auth/google/callback")
async def google_callback(code: str = "", state: str = "", error: str = ""):
    """Handle Google OAuth callback."""
    if error:
        return RedirectResponse(f"{settings.frontend_url}/login?error={error}")

    if state not in _oauth_states:
        return RedirectResponse(f"{settings.frontend_url}/login?error=invalid_state")
    _oauth_states.pop(state, None)

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": f"{settings.frontend_url}/api/auth/google/callback",
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            return RedirectResponse(f"{settings.frontend_url}/login?error=token_exchange_failed")
        tokens = token_resp.json()

        # Get user info
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if userinfo_resp.status_code != 200:
            return RedirectResponse(f"{settings.frontend_url}/login?error=userinfo_failed")
        userinfo = userinfo_resp.json()

    email = userinfo.get("email")
    name = userinfo.get("name", "")
    if not email:
        return RedirectResponse(f"{settings.frontend_url}/login?error=no_email")

    user = await get_or_create_oauth_user(email, name, "google")
    jwt_token = create_token(user["id"])

    return RedirectResponse(f"{settings.frontend_url}/login?token={jwt_token}")


# ── GitHub OAuth ─────────────────────────────────────────────

@router.get("/auth/github")
async def github_login():
    """Redirect user to GitHub's OAuth consent screen."""
    if not settings.github_client_id:
        raise HTTPException(501, "GitHub OAuth not configured")

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = "github"

    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": f"{settings.frontend_url}/api/auth/github/callback",
        "scope": "user:email",
        "state": state,
    }
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{urlencode(params)}")


@router.get("/auth/github/callback")
async def github_callback(code: str = "", state: str = "", error: str = ""):
    """Handle GitHub OAuth callback."""
    if error:
        return RedirectResponse(f"{settings.frontend_url}/login?error={error}")

    if state not in _oauth_states:
        return RedirectResponse(f"{settings.frontend_url}/login?error=invalid_state")
    _oauth_states.pop(state, None)

    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        if token_resp.status_code != 200:
            return RedirectResponse(f"{settings.frontend_url}/login?error=token_exchange_failed")
        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        if not access_token:
            return RedirectResponse(f"{settings.frontend_url}/login?error=no_access_token")

        # Get user profile
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        ghuser = user_resp.json()

        # Get primary email (may be private)
        email = ghuser.get("email")
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            if emails_resp.status_code == 200:
                for e in emails_resp.json():
                    if e.get("primary") and e.get("verified"):
                        email = e["email"]
                        break

        if not email:
            return RedirectResponse(f"{settings.frontend_url}/login?error=no_email")

    name = ghuser.get("name") or ghuser.get("login", "")
    user = await get_or_create_oauth_user(email, name, "github")
    jwt_token = create_token(user["id"])

    return RedirectResponse(f"{settings.frontend_url}/login?token={jwt_token}")
