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
| Free / premium tiers | ❌ Not built | Everything's gated by login, nothing by plan (§12) |
| Site tour / landing page | ❌ Not built | Visitors are redirected straight to login (§13) |
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
| **Razorpay** (primary, India) | Payments / subscriptions — UPI, cards, netbanking | 🟡 Only if monetizing at launch | ~2% domestic; needs business KYC |
| **Stripe** (optional, international) | Cards for non-India users | 🟡 Only if you sell abroad | 2.9% + 30¢/txn |
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

## 5. Cookie auth + the API URL — ✅ DONE (config note)

The auth uses an **httpOnly cookie**. The same-origin proxy setup is now wired:
- `lib/api.ts` defaults the browser base to **empty** → calls are relative
  (`fetch("/api/...")`) and ride the Next.js proxy on the frontend origin, so the
  cookie stays first-party and `SameSite=Lax` works with no CORS dance.
- `next.config.mjs` proxies `/api/*` to a **server-side** `BACKEND_INTERNAL_URL`
  (never exposed to the client), falling back to `NEXT_PUBLIC_API_URL` then localhost.

**To deploy (same-origin, recommended):**
- Frontend: set `BACKEND_INTERNAL_URL=https://<backend>`; leave `NEXT_PUBLIC_API_URL` **unset**.
  - ⚠️ **Next.js bakes the proxy destination into the build** (`routes-manifest.json`),
    so `BACKEND_INTERNAL_URL` must be present **at `next build` time**, not just at
    `next start`. On Vercel this is automatic (build env). If you change it, rebuild.
- Backend: `APP_ENV=production`, strong `JWT_SECRET` (the app refuses to boot
  without one), `cookie_secure=true`, `cookie_samesite=lax`.
- Verified locally: signup through the proxy sets the cookie first-party and
  `/api/auth/me` authenticates off the cookie alone (no Authorization header).

**Cross-site alternative** (browser hits the backend directly): set
`NEXT_PUBLIC_API_URL=https://<backend>`, `cookie_samesite=none`, `cookie_secure=true`,
and add the frontend origin to `cors_origins`. Only if you can't use the proxy.

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
greenfield feature. The gateway is just the *rail* that flips a user's `plan` to
`premium`; the **free-vs-premium model and gating logic** are specced in **§12** and
are **gateway-agnostic** — only checkout creation + webhook handling differ per
gateway. Before building, decide the model:

- **What's free vs. paid?** (e.g. free = curriculum + N interviews/month;
  paid = unlimited interviews + voice + history).
- **Pricing shape:** monthly/annual subscription is the natural fit. **Price in INR (₹).**

### Primary: Razorpay (India-first)

This is primarily an India product, so Razorpay is the primary rail — it covers
**UPI** (the dominant method in India), cards, netbanking, and wallets, and settles
in INR.

**Prerequisites (start these early — they gate go-live):**
- **Business KYC / activation** on Razorpay (PAN, bank account; GST optional but
  recommended). Activation can take a few days — don't leave it to launch week.
- Decide GST handling on prices (Razorpay can capture GST; you still own invoicing
  and tax filing). Show prices inclusive/exclusive consistently.

**Backend**
1. Add the `razorpay` SDK; store `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`.
2. Create **Plans** in the Razorpay dashboard (e.g. monthly/annual premium in INR).
3. `plan`/`status`/`razorpay_customer_id`/`razorpay_subscription_id`/`current_period_end`
   on `users` (or a `subscriptions` table) — the same fields §12 reads.
4. Endpoints:
   - `POST /api/billing/subscribe` → create a Razorpay **Subscription** (recurring;
     UPI AutoPay / e-mandate / card) or an **Order** (one-time) and return the
     `subscription_id`/`order_id` + `key_id` to the client.
   - `POST /api/billing/webhook` → **verify the signature** with
     `RAZORPAY_WEBHOOK_SECRET`, then handle `subscription.activated`,
     `subscription.charged`, `subscription.halted`, `subscription.cancelled`
     (and `payment.captured` / `payment.failed` for one-time). Flip `plan`/`status`.
   - `POST /api/billing/cancel` → cancel at period end.
5. **Gating dependency** (§12): one reusable check before LLM-billed actions.

**Frontend**
6. `/pricing` page (INR) → opens **Razorpay Checkout** (their JS SDK / hosted) with
   the `subscription_id`/`order_id`; on success the webhook is the source of truth.
7. Billing section in settings → show plan + a Cancel action.
8. Reflect plan/quota in the UI (e.g. "3 of 5 interviews used").

> **Verify payments server-side, not client-side.** Treat the webhook (signature-
> verified) as the source of truth for entitlement — never grant premium off the
> browser success callback alone.

### Optional: Stripe (international cards)

If you later sell to users outside India, add Stripe alongside Razorpay (Checkout +
`checkout.session.completed` / `customer.subscription.*` webhooks). The §12 gating is
shared; you just add a second checkout/webhook path and pick the gateway by user
region. Skip this until international demand is real.

**Effort:** Razorpay rail ~2–4 focused days (test mode + webhook), **excluding** KYC
wait time. Not required to launch a free product; required before charging.

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
- [ ] **Public landing page** (§13a) — needed the moment real traffic hits the domain.
- [ ] **Free tier + quota gating** (§12) — ships *before* payments; everyone defaults
      to `free`, premium actions are gated. Doubles as the LLM cost cap.
- [ ] **OAuth** Google/GitHub provisioned + a real end-to-end login test.
- [ ] **Email** provider for password reset (the flow itself is also net-new).
- [ ] **Error tracking** (Sentry) on frontend + backend.
- [ ] Basic analytics (Plausible/PostHog) to see what users do.

### P2 — when traffic justifies
- [ ] **Start Razorpay business KYC early** — it has multi-day lead time and gates
      live payments, so kick it off well before you need to charge.
- [ ] **Payments** (Razorpay, §7) — unlocks premium once the §12 gates exist.
- [ ] **In-app guided tour** (§13b) for new users.
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
# Later (payments): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
#                   (optional intl) STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
# Later (other):    EMAIL_* / SENTRY_DSN
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

Payments + Postgres add cost only when you actually need them. **Razorpay** has no
monthly fee — it's ~2% per domestic transaction (UPI often cheaper), deducted at
settlement, so it scales with revenue rather than adding fixed cost.

---

## 12. Freemium model (free tier + premium) — net-new

Today **everything is gated behind login but nothing is gated behind a plan** — a
logged-in user can do it all. Freemium = add a `plan` to each user and check it
before premium actions. The payment gateway (**Razorpay**, §7) is just the rail that
flips `plan` to `premium` — this gating is the same regardless of gateway. Price
premium in **INR (₹)** for the India market.

### Suggested free vs. premium split (tune to taste)

| Capability | Free | Premium |
|------------|------|---------|
| Curriculum lessons (Tier 0–6) | ✅ All | ✅ All |
| Adaptive quizzes | ✅ | ✅ |
| Mock interviews | ✅ **N / month** (e.g. 3) + SDE2/Senior only | ✅ Unlimited, all levels (Staff/Principal/VP) |
| Interview problems | ✅ A starter subset (e.g. 3) | ✅ All 10 |
| Voice mode (TTS + mic) | ❌ | ✅ |
| Interview history & replay | ✅ Last 1–2 | ✅ Full history |
| Daily challenge + leaderboard | ✅ | ✅ |
| Detailed scorecard (per-dimension reasons) | 🟡 Summary only | ✅ Full justifications |

The exact lines are a product call; the table is a starting point. Premium is built
around the **expensive + high-value** actions (LLM interviews, voice), which also
naturally caps your LLM spend on free users.

### What to build

**Backend**
- `plan` (`free` | `premium`) + quota fields on `users` (or a `subscriptions` table),
  written by the Stripe webhook (§7).
- A reusable **entitlement dependency**, e.g. `require_plan("premium")` and a
  `check_interview_quota(user)` guard, applied to: `POST /api/interview/start`
  (quota + level gate), the interview TTS endpoints (premium), and history depth.
- A monthly counter for free interviews (a `usage` row keyed by user + month;
  resets naturally by month key — no cron needed).
- `GET /api/billing/entitlements` → `{ plan, interviews_used, interviews_limit, features }`
  so the UI can render locks without guessing.

**Frontend**
- Read entitlements into the auth store; show **plan-aware UI**: lock badges on
  premium problems/levels, an "X of N interviews used" meter, and **upgrade CTAs**
  at the natural friction points (hitting the cap, clicking a locked level, the
  voice toggle).
- A `/pricing` page (free vs premium) → Stripe Checkout (§7).
- A graceful **"limit reached"** modal instead of a generic 403.

**Effort:** ~2–3 days on top of the Stripe rail (§7). Gating logic is the bulk;
keep the entitlement check in **one** backend dependency so it's not scattered.

> Sequencing: ship the **free tier with quotas first** (no payment needed — just the
> `plan`/quota model + gating, everyone defaults to `free`). Add Stripe to *unlock*
> premium once the gates exist. That lets you launch freemium before billing is done.

---

## 13. Site tour & onboarding — net-new

Two distinct pieces, often conflated:

### 13a. Public landing page (for visitors who aren't logged in)
Right now the app **redirects every unauthenticated visitor straight to `/login`** —
there's no marketing surface to explain the product or show pricing. Add a public
`/` (or `/welcome`) landing page that:
- Explains the pitch ("the interview that actually interviews you"), shows a short
  demo clip/screenshots, the free-vs-premium pricing (§12), and CTAs to sign up.
- Stays **public** (exclude it from the `ClientLayout` auth redirect; pairs with the
  deferred `middleware.ts` route protection).
- Doubles as the **Privacy/Terms** home needed for Google OAuth (§4, §9).

### 13b. In-app guided product tour (for new users, post-signup)
A first-run walkthrough highlighting the key surfaces (Curriculum → Interview → Ask
Prof. Arch → Daily/Leaderboard).
- Library: **`driver.js`** (tiny, no deps) or **`react-joyride`** (richer). Either is
  a small add.
- Trigger once on first login; persist "seen" so it doesn't repeat — store a
  `tour_completed` flag on the user profile (survives devices) or `localStorage`
  (simplest). A "Replay tour" entry in settings is a nice touch.
- 5–7 steps max; let users skip. Keep copy short.

**Effort:** landing page ~1 day; guided tour ~0.5–1 day. Neither is a hard launch
blocker, but the **landing page is important** the moment you point real traffic at
the domain (and it's where pricing/signup conversion happens).

---

## Shortest path to a live free product
1. Groq paid key + production secrets (§3, §10).
2. Apply the cookie/API-URL config (§5) — I can do this in code now.
3. Deploy frontend (Vercel) + backend (Fly/Railway) with a volume (§8).
4. Domain + TLS + CORS origin.
5. ToS/Privacy pages, then provision Google/GitHub OAuth.

Payments and email/reset come right after — they're not needed to open the doors,
but are needed before you charge or scale.
