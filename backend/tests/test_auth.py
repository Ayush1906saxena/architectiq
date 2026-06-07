"""Auth tests: cookie-based sessions, signup validation, OAuth state, header fallback."""
import pytest
from fastapi.testclient import TestClient

import db.database as dbmod
from config import settings
from main import app
from middleware import security as sec
from services.auth_service import (
    AUTH_COOKIE, create_state_token, verify_state_token,
)

SIGNUP = {"email": "alice@example.com", "username": "alice", "password": "password123"}


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "db_path", str(tmp_path / "auth.db"))
    monkeypatch.setattr(dbmod, "_db_initialized", False)
    # Reset the process-global rate-limit buckets so tests don't accumulate hits.
    for limiter in (sec._general_limiter, sec._llm_limiter, sec._start_limiter):
        limiter._buckets.clear()
    with TestClient(app) as c:
        yield c


# ── Cookie session flow ───────────────────────────────────────

def test_signup_sets_cookie_and_me_works(client):
    r = client.post("/api/auth/signup", json=SIGNUP)
    assert r.status_code == 200, r.text
    assert AUTH_COOKIE in r.cookies

    # /auth/me authenticates purely off the cookie jar — no Authorization header.
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == SIGNUP["email"]


def test_logout_clears_cookie(client):
    client.post("/api/auth/signup", json=SIGNUP)
    assert client.get("/api/auth/me").status_code == 200
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401


def test_login_flow(client):
    client.post("/api/auth/signup", json=SIGNUP)
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": SIGNUP["email"], "password": SIGNUP["password"]})
    assert r.status_code == 200
    assert AUTH_COOKIE in r.cookies


def test_login_wrong_password(client):
    client.post("/api/auth/signup", json=SIGNUP)
    r = client.post("/api/auth/login", json={"email": SIGNUP["email"], "password": "wrongpass1"})
    assert r.status_code == 401


# ── Validation ────────────────────────────────────────────────

def test_signup_rejects_bad_email(client):
    r = client.post("/api/auth/signup", json={**SIGNUP, "email": "not-an-email"})
    assert r.status_code == 400


def test_signup_rejects_short_password(client):
    r = client.post("/api/auth/signup", json={**SIGNUP, "password": "short"})
    assert r.status_code == 400


def test_signup_duplicate_email(client):
    client.post("/api/auth/signup", json=SIGNUP)
    r = client.post("/api/auth/signup", json={**SIGNUP, "username": "alice2"})
    assert r.status_code == 409


# ── Backward-compatible header auth ───────────────────────────

def test_authorization_header_still_works(client):
    token = client.post("/api/auth/signup", json=SIGNUP).json()["token"]
    client.cookies.clear()
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "alice"


def test_no_credentials_is_401(client):
    assert client.get("/api/auth/me").status_code == 401


# ── OAuth state (stateless CSRF guard) ────────────────────────

def test_oauth_state_roundtrip():
    tok = create_state_token("google")
    assert verify_state_token(tok, "google") is True


def test_oauth_state_wrong_provider_rejected():
    tok = create_state_token("google")
    assert verify_state_token(tok, "github") is False


def test_oauth_state_garbage_rejected():
    assert verify_state_token("not-a-token", "google") is False
