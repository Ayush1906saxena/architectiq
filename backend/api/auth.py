"""Auth endpoints — signup, login, OAuth (Google/GitHub), and current-user retrieval."""
import re
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Depends, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from config import settings
from services.auth_service import (
    get_user_by_email,
    create_user,
    verify_password,
    create_token,
    get_or_create_oauth_user,
    create_state_token,
    verify_state_token,
    DuplicateUserError,
    AUTH_COOKIE,
)
from middleware.auth import get_current_user

router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _set_auth_cookie(response: Response, token: str) -> None:
    """Set the httpOnly auth cookie so the token is never exposed to JS."""
    response.set_cookie(
        AUTH_COOKIE,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )


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
async def signup(req: SignupRequest, response: Response):
    if not _EMAIL_RE.match(req.email):
        raise HTTPException(400, "Invalid email address")
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if len(req.username) < 2:
        raise HTTPException(400, "Username must be at least 2 characters")

    if await get_user_by_email(req.email):
        raise HTTPException(409, "Email already registered")

    try:
        user = await create_user(req.email, req.username, req.password)
    except DuplicateUserError as e:
        raise HTTPException(409, str(e))

    token = create_token(user["id"])
    _set_auth_cookie(response, token)
    return AuthResponse(token=token, user=user)


@router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    user = await get_user_by_email(req.email)
    if not user or not user.get("password_hash") or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    token = create_token(user["id"])
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    _set_auth_cookie(response, token)
    return AuthResponse(token=token, user=safe_user)


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(AUTH_COOKIE, path="/")
    return {"ok": True}


@router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


# ── Google OAuth ─────────────────────────────────────────────

@router.get("/auth/google")
async def google_login():
    """Redirect user to Google's OAuth consent screen."""
    if not settings.google_client_id:
        raise HTTPException(501, "Google OAuth not configured")

    state = create_state_token("google")

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

    if not verify_state_token(state, "google"):
        return RedirectResponse(f"{settings.frontend_url}/login?error=invalid_state")

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

    resp = RedirectResponse(f"{settings.frontend_url}/login?login=success")
    _set_auth_cookie(resp, jwt_token)
    return resp


# ── GitHub OAuth ─────────────────────────────────────────────

@router.get("/auth/github")
async def github_login():
    """Redirect user to GitHub's OAuth consent screen."""
    if not settings.github_client_id:
        raise HTTPException(501, "GitHub OAuth not configured")

    state = create_state_token("github")

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

    if not verify_state_token(state, "github"):
        return RedirectResponse(f"{settings.frontend_url}/login?error=invalid_state")

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

    resp = RedirectResponse(f"{settings.frontend_url}/login?login=success")
    _set_auth_cookie(resp, jwt_token)
    return resp
