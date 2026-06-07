"""Auth dependency — extracts the current user from the auth cookie or Bearer token."""
from fastapi import Request, HTTPException, status

from services.auth_service import decode_token, get_user_by_id, AUTH_COOKIE


def _extract_token(request: Request) -> str | None:
    """Prefer the Authorization header; fall back to the httpOnly auth cookie."""
    auth = request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            return token
    return request.cookies.get(AUTH_COOKIE)


async def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user_id = decode_token(token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = await get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_optional_user(request: Request) -> dict | None:
    """Same as get_current_user but returns None instead of 401 when unauthenticated."""
    token = _extract_token(request)
    if not token:
        return None
    user_id = decode_token(token)
    if user_id is None:
        return None
    return await get_user_by_id(user_id)
