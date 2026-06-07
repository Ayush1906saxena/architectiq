# ArchitectIQ — Go-Live Plan

> What it takes to put ArchitectIQ in front of real users: integrations to set up,
> what's already built vs. net-new, deployment, and a phased checklist.
> Reflects the codebase as of the `tier-3-4-hardening` branch.

---

## 1. Where things stand

| Area | Status | Notes |
|------|--------|-------|
| Interview engine + scoring | ✅ Works (LLM via Groq) | Hardened + tested on `engine-hardening` |
| Auth (email/password) | ✅ Works | httpOnly cookie sessions |
| Auth (Google/GitHub OAuth) | 🟡 Code done, **needs credentials** | Not live-tested (no creds yet) |
| LLM (Groq) | 🟡 Works on **free tier** | 6,000 tokens/min cap is the real bottleneck — needs a paid tier |
| TTS (voice) | 🟡 gTTS (unofficial, free) | Fine for demo; not production-grade |
| Database | 🟡 SQLite file | Fine for launch/single instance; not multi-instance |
| Payments / billing | ❌ **Not built** | No code at all — net-new work |
| Email (reset/verify) | ❌ Not built | No password reset, no verification |
| Hosting / domain / TLS | ❌ Not set up | docker-compose is local-only |
| Monitoring / error tracking | ❌ None | No Sentry/logs aggregation |
| Legal (ToS / Privacy) | ❌ None | **Required** for Google OAuth verification + payments |

**Note on Supabase:** `backend/.env` has `SUPABASE_*` keys, but **no code uses them**.
It's a dead config. Either delete it or adopt Supabase as your managed Postgres
(see §6 DB). Don't leave live keys sitting unused.

---

## 2. Third-party integrations to set up

| Service | Purpose | Required for launch? | Cost |
|---------|---------|----------------------|------|
| **Groq** (or other LLM) | Interview AI, scoring, quizzes, "Ask" | ✅ Yes — core product | Free tier too small; ~$0.05–0.10 / 1M tokens on paid |
| **Google OAuth** | "Sign in with Google" | 🟡 If you want it at launch | Free |
| **GitHub OAuth** | "Sign in with GitHub" | 🟡 Optional | Free |
| **Stripe** | Payments / subscriptions | 🟡 Only if monetizing at launch | 2.9% + 30¢/txn |
| **Email provider** (Resend/SES/Postmark) | Password reset, receipts | 🟡 Strongly recommended | ~Free–$20/mo |
| **Hosting** (Vercel + Fly/Railway/Render) | Run the apps | ✅ Yes | ~$5–25/mo to start |
| **Error tracking** (Sentry) | Catch prod errors | 🟡 Recommended | Free tier fine |
| **Domain + TLS** | Your URL | ✅ Yes | ~$12/yr (TLS free) |

---

## 3. LLM — the one that actually gates the experience

This is the most important integration. Live testing showed the **Groq free tier
(6,000 tokens/min) gets the interviewer rate-limited mid-conversation** — every turn
makes 2 LLM calls, and the scorer adds a third at the end.

**To launch:**
1. **Upgrade Groq to a paid tier** (raises the TPM cap dramatically), OR switch
   `LLM_PROVIDER`/model to another provider. The client already abstracts Groq vs.
   Ollama; adding e.g. an OpenAI-compatible endpoint is a small change in
   `backend/services/ollama_client.py`.
2. Set `GROQ_API_KEY` (and optionally `GROQ_MODEL`) as a **production secret**.
3. Decide a per-user usage cap (interviews/day) to bound cost — the rate limiter
   exists but a per-account quota does not yet (see §7 if you gate by plan).

**Rough cost:** a full interview ≈ 30–60K tokens. At ~$0.10/1M that's well under a
cent per interview on a small model — cheap until you have real volume. The free
tier's *rate limit*, not price, is the blocker.

---

## 4. OAuth setup (code is done — you just provision)

The flow is already implemented (stateless signed `state`, httpOnly cookie on
callback). You need to create the apps and set secrets.

### Google
1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web).
2. **Authorized redirect URI:** `https://<your-domain>/api/auth/google/callback`
3. **Authorized JS origin:** `https://<your-domain>`
4. Configure the **OAuth consent screen** — needs an app name, support email, and a
   **Privacy Policy URL** (see §9 legal). `email`/`profile` scopes are non-sensitive,
   so no Google verification review is required to go live.
5. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### GitHub
1. GitHub → Settings → Developer settings → **OAuth Apps** → New.
2. **Callback URL:** `https://<your-domain>/api/auth/github/callback`
3. Set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

> ⚠️ The callback URLs point at **your frontend domain** because Next.js proxies
> `/api/*` to the backend (see §5). Keep that proxy in place or the callbacks break.

---

## 5. ⚠️ Cookie auth + the API URL (read before deploying)

The new auth uses an **httpOnly cookie**. Whether it works in prod depends on one
config choice, because `frontend/next.config.mjs` proxies `/api/*` to the backend.

**Recommended: same-origin via the proxy (simplest, most secure).**
- Browser always talks to the **frontend origin**; Next forwards `/api/*` to the backend.
- The cookie is then first-party → `SameSite=Lax` "just works", no CORS headaches.
- **Change needed:** today `NEXT_PUBLIC_API_URL` is used for *both* the browser's
  fetch base (`lib/api.ts`) *and* the proxy destination (`next.config.mjs`). For
  same-origin you want:
  - Browser base → **relative/empty** (so `fetch("/api/...")` hits Next).
  - Proxy destination → an **internal** backend URL (server-side env, not `NEXT_PUBLIC_`).
  - i.e. split into `NEXT_PUBLIC_API_URL=""` (or your own origin) and a new
    `BACKEND_INTERNAL_URL` used only in `next.config.mjs`. ~10-line change; I can do it.

**Alternative: browser calls the backend directly (cross-site).**
- Set `cookie_samesite=none`, `cookie_secure=true`, and add the frontend origin to
  `cors_origins`. Works, but more moving parts. Only pick this if you can't proxy.

Either way, in production set `APP_ENV=production`, a strong `JWT_SECRET` (the app
now refuses to boot without one), and `cookie_secure=true`.

---

## 6. Database — SQLite is fine to launch, with eyes open

- **Now:** one SQLite file on a mounted volume. WAL + indexes + migrations are in
  place. Good for a **single backend instance**.
- **Limits:** can't run >1 backend instance against it; the file must live on
  persistent storage (not an ephemeral container FS); back it up.
- **When to move:** the moment you need >1 instance or managed backups, migrate to
  **Postgres** (Supabase, Neon, or RDS). The schema is plain SQL; the main work is
  swapping `aiosqlite` for `asyncpg`/SQLAlchemy and porting `db/init.sql`. Not a
  launch blocker — plan it for when traffic justifies it.
- **Also in-memory today (lost on redeploy):** live interview sessions, rate-limit
  buckets. Acceptable single-instance; revisit with Postgres/Redis when you scale.

---

## 7. Payments (net-new — nothing exists yet)

There is **no billing code, no plan/quota concept, and no paywall**. This is a
greenfield feature. Before building, decide the model:

- **What's free vs. paid?** (e.g. free = curriculum + N interviews/month;
  paid = unlimited interviews + voice + history).
- **Pricing shape:** monthly/annual subscription is the natural fit.

**Recommended stack: Stripe.** Implementation outline:

**Backend**
1. Add `stripe` SDK; store `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`.
2. Add a `subscriptions` table (or columns on `users`): `plan`, `status`,
   `stripe_customer_id`, `current_period_end`.
3. Endpoints: `POST /api/billing/checkout` (create Checkout Session),
   `POST /api/billing/portal` (Stripe customer portal), and
   `POST /api/billing/webhook` (handle `checkout.session.completed`,
   `customer.subscription.updated/deleted`).
4. **Gating:** a dependency that checks the user's plan/quota before LLM-billed
   actions (start interview, etc.). This is where the per-plan interview cap lives.

**Frontend**
5. Pricing/upgrade page → calls checkout → redirects to Stripe.
6. Billing section in settings → opens the customer portal.
7. Reflect plan/quota in the UI (e.g. "3 of 5 interviews used").

**Effort:** ~2–4 focused days including testing with Stripe test mode + webhook.
Not required to launch a free product; required before charging.

---

## 8. Deployment architecture (recommended)

```
        Users ──HTTPS──► Frontend (Next.js on Vercel)
                              │  /api/* proxied
                              ▼
                         Backend (FastAPI on Fly.io / Railway / Render)
                              │
                     ┌────────┴────────┐
                  SQLite vol        Groq API
                 (persistent)     (LLM, paid)
```

- **Frontend → Vercel** (native Next.js; set env vars there).
- **Backend → Fly.io / Railway / Render** (container from `backend/Dockerfile`),
  with a **persistent volume** for `DB_PATH` and `TTS_CACHE_DIR`.
- **Drop the `ollama` service** from `docker-compose.yml` for prod (you're on Groq).
- **TLS** is automatic on all three platforms.
- Health check endpoint already exists: `GET /api/health`.

---

## 9. Pre-launch checklist

### P0 — launch blockers
- [ ] **LLM:** upgrade Groq to paid (or swap provider); set `GROQ_API_KEY` secret.
- [ ] **Secrets:** strong `JWT_SECRET`, `APP_ENV=production`, `cookie_secure=true`.
- [ ] **Cookie/API URL:** apply the same-origin config from §5 (or the cross-site
      alternative). I can make this code change.
- [ ] **CORS:** add the real frontend origin to `cors_origins` (defaults to localhost).
- [ ] **Hosting:** deploy frontend + backend; backend on a **persistent volume**.
- [ ] **Domain + TLS** wired to both.
- [ ] **DB backups** (even a nightly volume snapshot).
- [ ] **Legal:** Terms of Service + Privacy Policy pages (needed for Google consent).
- [ ] Remove the unused `SUPABASE_*` keys from `.env` (or adopt them intentionally).

### P1 — should-have soon after
- [ ] **OAuth** Google/GitHub provisioned + a real end-to-end login test.
- [ ] **Email** provider for password reset (the flow itself is also net-new).
- [ ] **Error tracking** (Sentry) on frontend + backend.
- [ ] **Per-user usage cap** to bound LLM cost.
- [ ] Basic analytics (Plausible/PostHog) to see what users do.

### P2 — when traffic justifies
- [ ] **Payments** (Stripe) — only when you're ready to monetize (§7).
- [ ] **Postgres** migration + Redis for sessions/rate-limit (multi-instance).
- [ ] Production-grade **TTS** if voice becomes a selling point.
- [ ] Server-side route protection (`middleware.ts`), interview-page refactor, a11y
      sweep (the deferred Tier-4 items).

---

## 10. Environment variables (production)

**Backend**
```
APP_ENV=production
JWT_SECRET=<32+ random chars>          # app refuses to boot without this in prod
GROQ_API_KEY=<paid key>
GROQ_MODEL=llama-3.1-8b-instant
LLM_PROVIDER=groq
DB_PATH=/data/architectiq.db           # on a persistent volume
TTS_CACHE_DIR=/data/tts_cache
CONTENT_DIR=./content
FRONTEND_URL=https://<your-domain>
cookie_secure=true
cookie_samesite=lax                    # "none" only if cross-site (see §5)
cors_origins=["https://<your-domain>"]
GOOGLE_CLIENT_ID=...  GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...  GITHUB_CLIENT_SECRET=...
# Later: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, EMAIL_* / SENTRY_DSN
```

**Frontend**
```
NEXT_PUBLIC_API_URL=                    # empty/relative for same-origin proxy (§5)
BACKEND_INTERNAL_URL=https://<backend>  # new var for next.config proxy destination
```

---

## 11. Rough monthly cost to start

| Item | Est. |
|------|------|
| Frontend (Vercel hobby/pro) | $0–20 |
| Backend (Fly/Railway/Render small) | $5–15 |
| LLM (Groq paid, low volume) | $5–30 |
| Domain | ~$1 |
| Email / Sentry / analytics | mostly free tiers |
| **Total to launch** | **~$15–65/mo** |

Payments + Postgres add cost only when you actually need them.

---

## Shortest path to a live free product
1. Groq paid key + production secrets (§3, §10).
2. Apply the cookie/API-URL config (§5) — I can do this in code now.
3. Deploy frontend (Vercel) + backend (Fly/Railway) with a volume (§8).
4. Domain + TLS + CORS origin.
5. ToS/Privacy pages, then provision Google/GitHub OAuth.

Payments and email/reset come right after — they're not needed to open the doors,
but are needed before you charge or scale.
