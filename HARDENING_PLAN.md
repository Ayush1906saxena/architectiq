# ArchitectIQ — Tier 3 & 4 Hardening Plan

> Status: **proposal for review**. Nothing here is implemented yet.
> Context: builds on the `engine-hardening` branch (engine reliability/correctness +
> tests, already merged-ready). This plan covers **Tier 3 (backend production
> hardening)** and **Tier 4 (frontend robustness)**.

---

## TL;DR

The app currently runs as **a single uvicorn process with a single SQLite file**
(confirmed in `docker-compose.yml` / `backend/Dockerfile` — no `--workers`). That
matters: several "scary" findings (in-memory session store, per-process rate
limiter) are **not broken today** but (a) lose all live state on every redeploy and
(b) block horizontal scaling the moment you add a second worker. I've split each
item into *"fix now, cheap"* vs *"only needed when you scale"* so you can decide how
far to go.

The genuinely urgent items are small and high-value: **JWT fail-fast**, **SQLite
WAL + indexes**, and **stop putting the JWT in the redirect URL**.

---

## Decisions I need from you

1. **Auth token storage (Tier 4 #1).** Move the JWT from `localStorage` to an
   `httpOnly` cookie? This is the single biggest security win but it's an
   **architectural change** that couples backend + frontend (CORS `credentials`,
   CSRF protection, cookie flags). Alternative: keep `localStorage` but centralize
   handling and add 401 logout. **My rec: do the cookie**, but it's the one item I'd
   want your sign-off on before starting.
2. **Scaling horizon.** Are you planning to run more than one backend worker /
   container in the next while? If **no**, I'll keep interview sessions + OAuth state
   in-process but make them survive restarts (persist to SQLite) — cheap. If **yes**,
   they need a shared store (Redis), which is a bigger lift. **My rec: assume
   single-process for now**, design so swapping in Redis later is a one-file change.
3. **Scope of Tier 4.** Full pass (including splitting the 509-line interview page
   and an a11y sweep), or just the correctness/security items (API client, 401s,
   voice/mic bugs, typing)? **My rec: correctness/security now, defer the cosmetic
   refactor.**

---

## Tier 3 — Backend hardening

### 3.1 — JWT secret fail-fast  · **effort: XS · risk: none · do first**
- **Problem:** `config.py:18` defaults `jwt_secret = "change-me-in-production"` with
  no guard. If the env var is unset in prod, tokens are signed with a public string
  and anyone can forge a JWT for any user.
- **Fix:** on startup, raise if `jwt_secret` is the default (or shorter than ~32
  chars) unless an explicit `ENV=dev` is set. ~5 lines in `config.py` / `main.py`
  lifespan.
- **Risk:** none — it only fails when already misconfigured.

### 3.2 — SQLite WAL + busy_timeout + indexes  · **effort: S · risk: low · do first**
- **Problem:** `db/database.py` opens a fresh connection per request with **no**
  `journal_mode=WAL` and **no** `busy_timeout` (grep for PRAGMA returns nothing), so
  concurrent writes throw `database is locked`. No indexes on hot columns:
  `interview_history(user_id)` is scanned in `history.py`, `recommendations.py`, and
  the leaderboard `GROUP BY user_id`.
- **Fix:** set `PRAGMA journal_mode=WAL` + `PRAGMA busy_timeout=5000` on connect;
  add indexes on `interview_history(user_id)` and `interview_history(session_id)` in
  `db/init.sql`.
- **Risk:** low; WAL is standard and backward-compatible.

### 3.3 — Stop delivering the JWT in the redirect URL  · **effort: S · risk: low · do first**
- **Problem:** `api/auth.py:152` (and GitHub equivalent) does
  `RedirectResponse(f"{frontend_url}/login?token={jwt_token}")`. The 7-day token
  lands in browser history, server logs, and the `Referer` header.
- **Fix:** depends on decision #1. With cookies: set the `httpOnly` cookie on the
  redirect response, no token in URL. Without: issue a short-lived one-time code,
  exchange it server-side for the token. **Cookie path is cleaner.**
- **Risk:** low–medium (touches the OAuth callback the frontend reads at
  `login/page.tsx`).

### 3.4 — Persist interview sessions  · **effort: M · risk: medium**
- **Problem:** `services/interview_engine.py:27` `_sessions: dict = {}` holds all
  live interview state in memory. On restart/redeploy every in-progress interview is
  lost (next `/message` 404s). It also caused the `transcript_json=NULL` save bug if
  a worker ever differs (moot at 1 worker, real at 2+).
- **Fix (single-process):** serialize tracker state + transcript to a `sessions`
  table on each turn (or on a debounce); rehydrate on miss. Keep the in-memory dict
  as a write-through cache.
- **Fix (multi-process):** same interface, Redis backend.
- **Risk:** medium — the tracker has live objects (`Claim`, `Contradiction`,
  `Depth` enums); needs clean (de)serialization. The `to_state_dict()` already
  exists but isn't a full snapshot, so this needs a real `to_snapshot()/from_snapshot()`.
- **Note:** I'd gate this on decision #2. If you're fine losing in-progress
  interviews on deploy (they're short), this can be **deferred** — but the
  `transcript_json=NULL` path should still be hardened.

### 3.5 — OAuth state store  · **effort: S–M · risk: low**
- **Problem:** `api/auth.py:23` `_oauth_states = {}` is in-memory with no TTL — leaks
  memory, and a restart between redirect and callback fails every login with
  `invalid_state`. Breaks entirely at 2+ workers.
- **Fix (single-process):** add a TTL + periodic eviction (cheap). **Better:** make
  `state` a short-lived signed JWT so it's stateless — no store at all.
- **My rec:** stateless signed `state` — kills the bug and the memory leak together.

### 3.6 — Real migrations  · **effort: S · risk: low**
- **Problem:** `db/database.py:32-35` is a bare `ALTER TABLE … ADD COLUMN` wrapped in
  `except Exception: pass`, which hides real errors (locked DB, disk full) as
  "column exists." No version tracking.
- **Fix:** a `schema_version` table + ordered migration list; catch only the
  duplicate-column error. Lightweight; avoids pulling in Alembic.

### 3.7 — Leaderboard N+1  · **effort: S · risk: low**
- **Problem:** `api/leaderboard.py:33-40` runs a per-row `user_streaks` query inside
  the rank loop; `leaderboard/me` fetches the whole ranked table and scans it in
  Python (`:61`).
- **Fix:** single `LEFT JOIN user_streaks` query; use a windowed/`RANK()` query for
  `me`.
- **Risk:** low.

### 3.8 — Rate limiter & request-size middleware  · **effort: S · risk: low**
- **Problem:** `middleware/security.py:28` buckets are per-process (fine at 1 worker,
  ×N at more) and keyed on `request.client.host` (`:83`) which is the proxy IP behind
  a load balancer. `RequestSizeLimitMiddleware` trusts the client `Content-Length`
  header rather than measuring the body. And `sanitize_for_prompt` has a dead
  `text = text` no-op branch (`:149`) that pretends to handle injection but doesn't.
- **Fix:** honor a trusted `X-Forwarded-For` for the client key; measure streamed
  body size; either implement or delete the misleading sanitize branch. Redis bucket
  only if you go multi-worker.
- **Risk:** low.

### 3.9 — Smaller consistency cleanups  · **effort: S · risk: low · batch last**
- Standardize DB access on one `async with get_db()` context manager (today three
  idioms coexist; `progress_service.py:11` bypasses `get_db`).
- Move inline `import` statements (`api/interview.py`, `api/auth.py`) to module top.
- `EmailStr` instead of `str` for emails; rely on the DB `UNIQUE` constraint +
  `IntegrityError` instead of check-then-insert (TOCTOU in `auth.py` and
  `daily.py`).
- Replace deprecated `datetime.utcnow()` with `datetime.now(timezone.utc)`.

---

## Tier 4 — Frontend robustness

### 4.1 — Token storage → httpOnly cookie  · **effort: M · risk: medium · needs decision #1**
- **Problem:** the bearer token lives in `localStorage`
  (`store/useAuthStore.ts`, `lib/api.ts:9`, `login/page.tsx:27`) — readable by any
  injected script (XSS exfiltration).
- **Fix:** backend sets `httpOnly`, `Secure`, `SameSite` cookie (pairs with 3.3);
  frontend stops touching the token directly; fetches send `credentials: 'include'`.
- **Risk:** medium — CORS + CSRF implications; coordinated backend change.

### 4.2 — Centralized API client  · **effort: M · risk: low · high value**
- **Problem:** auth is hand-bolted per fetch in `lib/api.ts`, so several per-user
  endpoints send **no** auth header (e.g. `sendInterviewMessage`, `fetchScorecard`,
  `fetchProgress`) while others do. `API_BASE` is redefined in three places
  (`api.ts:6`, `useAuthStore.ts:20`, `login/page.tsx:8`).
- **Fix:** one `apiFetch()` wrapper that always injects auth, sets `Content-Type`,
  parses JSON, and centralizes the base URL. Migrate all calls (incl. auth) through it.
- **Risk:** low, but touches every call site — do it as one mechanical pass.

### 4.3 — 401 / expired-token handling  · **effort: S · risk: low**
- **Problem:** `lib/api.ts` throws a generic error on any non-OK; a 401 after token
  expiry is indistinguishable from a 500 and never logs the user out. Only app-boot
  (`useAuthStore.loadUser`) clears a bad token.
- **Fix:** in `apiFetch()`, on 401 call `useAuthStore.logout()` and redirect to
  `/login`. Falls out of 4.2.

### 4.4 — Voice / mic bugs  · **effort: M · risk: low · real UX bugs**
- **Problems** (all in `app/interview/[challengeId]/page.tsx`):
  - Toggling voice mid-interview changes `initInterview`'s identity and the effect at
    `:160` **re-runs it — restarting the whole session.**
  - The transcript→input sync effect (`:114`) overwrites manually typed text.
  - `handleMicToggle` (`:203`) auto-sends via a `setTimeout(200ms)` that races the
    final speech result, so it can fire with incomplete/empty text.
- **Fix:** stabilize `initInterview` deps (don't depend on `voiceEnabled`); gate the
  transcript sync on `isListening`; drive auto-send off the recognition `onend` +
  final transcript, not a timer. Add unmount cleanup for active audio/recognition.
- **Risk:** low; isolated to the interview page.

### 4.5 — Type the API responses  · **effort: S–M · risk: none**
- **Problem:** ~15 functions in `lib/api.ts` return `Promise<any>`; the interview
  page casts blind and even forces `scorecard as never` (`page.tsx:503`).
- **Fix:** define response interfaces in `src/types` (the engine just gained a stable
  shape — `dimension_reasons`, etc.); remove the casts.
- **Risk:** none functionally; may surface latent shape mismatches (a good thing).

### 4.6 — Network-failure UI states  · **effort: S · risk: low**
- **Problem:** silent `.catch(() => {})` on the home page (`app/page.tsx:30,35`) and
  interview index leaves spinners stuck forever; several fetchers return `null` on
  failure, conflating "no data" with "request failed."
- **Fix:** distinguish loading / empty / error; add a retry affordance.

### 4.7 — Deferred (cosmetic, only if you want a full pass)
- **Route protection:** add `middleware.ts` for server-side gating (clean once 4.1
  makes the token a cookie). Today gating is client-only (`ClientLayout.tsx:18`).
- **Split the 509-line interview page** into `useInterviewSession` / `useInterviewVoice`
  hooks + smaller components.
- **a11y sweep:** `aria-label`s on icon buttons, an ARIA live region for interviewer
  replies, `role="alert"` on error banners.
- **Store reset on logout:** clear `progress`/quiz caches (today they persist across
  sessions).

---

## Recommended sequencing

1. **Quick security/reliability batch (½ day):** 3.1 JWT fail-fast, 3.2 WAL+indexes,
   3.6 migrations, 3.7 leaderboard, 3.8 middleware. Low risk, immediate value.
2. **OAuth correctness:** 3.3 token-not-in-URL + 3.5 stateless state (+ decision #1).
3. **Frontend correctness batch:** 4.2 API client → 4.3 401s → 4.5 typing → 4.6
   error states → 4.4 voice/mic. (4.2 first because the rest build on it.)
4. **Auth cookie migration:** 4.1 + finish 3.3, if you approve decision #1.
5. **Optional:** 3.4 session persistence (gate on scaling), 4.7 cosmetic pass.

Each numbered step is independently shippable and testable. I'll add tests where
there's logic to test (migrations, leaderboard query, the API client wrapper).

---

## Out of scope (tracked, not planned here)
- **Contradiction-detection recall** — the engine work made it *precise* but it still
  misses real contradictions tagged under different concept ids. Reliable detection
  needs an LLM judge. Flagged from live testing; decide separately.
