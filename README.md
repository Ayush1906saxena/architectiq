# ArchitectIQ

**The system design interview simulator that actually interviews you.**

ArchitectIQ is an AI-powered platform that teaches system design from first principles and tests your knowledge through realistic mock interviews. It doesn't quiz you with flashcards — it puts you in a live interview with an AI interviewer that probes, challenges, catches contradictions, and adapts to your skill level.

---

## What Makes This Different

Most system design prep tools give you a video to watch or a checklist to memorize. ArchitectIQ gives you a **live conversation** with an interviewer who:

- **Never gives you the answer** — only asks questions that reveal whether you know it
- **Catches your contradictions** — "Earlier you said eventual consistency is fine. But this design requires reading your own writes. Which is it?"
- **Probes when you name-drop** — "You said Kafka. Why Kafka and not RabbitMQ? What's the partition strategy?"
- **Adapts to your level** — warm and patient for SDE2, direct and unforgiving for Staff+
- **Scores you on 8 dimensions** — not just "pass/fail" but a detailed rubric showing exactly where you're strong and where you're weak

The interviewer is powered by a 4-layer architecture where **only the final speech layer uses an LLM**. All critical logic — tracking what you've covered, deciding what to ask next, scoring your performance — is deterministic. The AI makes the conversation natural; the rules make the evaluation fair.

---

## The Platform

### 1. Structured Curriculum (Tier 0-6)

174 lessons across 41 modules, from "What is a Computer?" to "ML System Design":

| Tier | Focus | Modules |
|------|-------|---------|
| **0 - Foundations** | CPU, networking, databases, web basics | 4 |
| **1 - Single Server** | Web servers, storage, caching, concurrency | 4 |
| **2 - Distributed Systems** | Load balancing, sharding, replication, CAP, consensus | 7 |
| **3 - Design Patterns** | API gateways, message queues, microservices, observability | 5 |
| **4 - HLD Practice** | 10 classic system design problems with walkthroughs | 10 |
| **5 - LLD Practice** | Object-oriented design: parking lot, LRU cache, chess | 6 |
| **6 - Expert Mastery** | Database internals, distributed DB, data processing, ML systems | 5 |

### 2. Live Mock Interviews

The core feature. Choose a problem and career level, then design the system in a real-time conversation:

**10 Problems:**
URL Shortener, Rate Limiter, Key-Value Store, Twitter Feed, Chat System, Video Streaming, Search Engine, Ride Sharing, Payment System, Message Queue

**5 Career Levels:**

| Level | Interviewer Persona | Duration | What's Expected |
|-------|-------------------|----------|-----------------|
| **SDE2** | The Mentor — warm, patient | 30 min | Basic working design. Trade-offs are a bonus. |
| **Senior** | The Tech Lead — friendly but rigorous | 40 min | Drive the design. Do capacity math. Discuss trade-offs. |
| **Staff** | The Principal Engineer — direct, no hand-holding | 45 min | Drive everything. Go 2-3 levels deep. Production-grade failure handling. |
| **Principal** | The VP of Engineering — peer conversation | 50 min | Architecture across teams. Cost analysis. Migration strategy. |
| **VP** | The CTO — strategic, business-aligned | 55 min | Business context first. Regulatory. Org design. 3-year vision. |

**8-Dimension Scoring:**

Every interview produces a detailed scorecard:

```
Requirements Gathering  ████████░░  8/10
Capacity Estimation     ██████████  10/10
API Design              ██████░░░░  6/10
Database Design         ████████░░  8/10
Caching Strategy        ████████░░  8/10
Scalability             ██████████  10/10
Failure Handling        ████████░░  8/10
Communication           ████████░░  8/10

Overall: 82/100 — PASSED (Staff bar: 75)
```

### 3. Adaptive Quizzes

AI-generated quiz questions that adapt to your knowledge level. Get a question wrong, and the next one targets the same concept at a simpler angle.

---

## Architecture

```
                    +-----------+
                    |  Frontend |  Next.js 14 + React
                    |  :3000    |  Real-time chat UI
                    +-----+-----+
                          |
                    +-----v-----+
                    |  Backend  |  FastAPI
                    |  :8000    |  Interview engine
                    +-----+-----+
                          |
            +-------------+-------------+
            |             |             |
      +-----v----+  +----v-----+ +----v----+
      | Analyzer  |  | Tracker  | | Scorer  |
      | (LLM +   |  | (State   | | (Rubric |
      | keywords) |  |  machine)| |  based) |
      +-----+----+  +----+-----+ +---------+
            |             |
      +-----v----+  +----v------+
      |Strategist|  |  Speaker  |
      |(Priority |  | (LLM with |
      | rules)   |  |  strict   |
      +----------+  |  prompt)  |
                    +-----+-----+
                          |
                    +-----v-----+
                    |    LLM    |  Groq (cloud, free key) by default
                    |  provider |  or Ollama (local) — set LLM_PROVIDER
                    +-----------+
```

**The 4-Layer Interview Engine:**

| Layer | What It Does | Uses LLM? |
|-------|-------------|-----------|
| **1. Analyzer** | Extracts concepts, numbers, decisions, and depth signals from candidate's text | Lightweight (keyword fallback available) |
| **2. Tracker** | Maintains interview state: coverage, contradictions, depth, phase, rubric scores | No — pure deterministic state machine |
| **3. Strategist** | Decides what to do next using an 11-tier priority system | No — pure deterministic rules |
| **4. Speaker** | Converts structured actions into natural interviewer dialogue | Yes — LLM with strict behavioral prompt |

The key insight: **the LLM makes the interviewer sound human, but deterministic code makes the interviewer smart.** The Strategist always catches contradictions, always probes shallow claims, always transitions at the right time — regardless of LLM quality.

---

## Quick Start

### 1. Get an LLM key (default: Groq — free)

Create a free key at [console.groq.com](https://console.groq.com), then:

```bash
git clone <repo-url> && cd architectiq
cp .env.example .env          # then set GROQ_API_KEY=gsk_...
```

> Prefer fully local? Set `LLM_PROVIDER=ollama`, run `ollama serve`, and
> `ollama pull llama3.2` — no cloud key needed.

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

The frontend proxies `/api/*` to the backend (see `next.config.mjs`), so the auth
cookie stays first-party.

### Environment Variables

See `.env.example` for the full list. The ones that matter most:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `groq` | `groq` (cloud) or `ollama` (local) |
| `GROQ_API_KEY` | — | Required when `LLM_PROVIDER=groq` |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq model id |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama endpoint (local mode) |
| `JWT_SECRET` | `change-me-...` | **App refuses to start in production unless this is strong (32+ chars)** |
| `APP_ENV` | `development` | `production` enables the JWT fail-fast |
| `FRONTEND_URL` | `http://localhost:3000` | Used for OAuth redirects |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | — | OAuth (optional) |
| `cookie_secure` / `cookie_samesite` | `false` / `lax` | Auth cookie flags (use `true`/`none` for cross-site) |
| `CONTENT_DIR` | `./content` | Curriculum and knowledge graphs |
| `DB_PATH` | `./data/architectiq.db` | SQLite database |
| `NEXT_PUBLIC_API_URL` | _(empty)_ | Leave empty for the same-origin proxy; set only for a cross-site backend |
| `BACKEND_INTERNAL_URL` | — | Frontend → backend proxy target (must be set **at build time**) |

---

## Authentication

Accounts use **JWT sessions delivered as an httpOnly cookie** (not readable by JS):

- **Email / password** — `POST /api/auth/signup`, `/api/auth/login`, `/api/auth/logout`
- **OAuth** — Google and GitHub (`/api/auth/google`, `/api/auth/github`), CSRF-guarded
  with a short-lived signed `state`
- The whole app is gated behind login; the auth middleware accepts the cookie or an
  `Authorization: Bearer` header.

---

## API

```
GET    /api/interview/problems              List available problems
POST   /api/interview/start                 Start session {problem_id, career_level}
POST   /api/interview/message               Send message {session_id, message}
POST   /api/interview/{id}/end              End interview early
GET    /api/interview/{id}/scorecard         Get final scores
GET    /api/interview/{id}/state             Get live interview state
```

---

## Knowledge Graphs

Each problem has a knowledge graph (`content/knowledge-graphs/*.json`) that defines:

- **Concepts** the candidate should cover (e.g., `base62_encoding`, `redis_caching`, `sharding_strategy`)
- **Probes** per concept — verify, deepen, challenge, and anti-BS questions
- **Rubric mapping** — which concepts feed into which scoring dimensions
- **Keywords** for the response analyzer to detect without LLM

The Strategist uses this graph to decide what to ask next. If the candidate mentions "consistent hashing" at buzzword depth, the Strategist queues a verify probe. If they explain it well, it queues a challenge. If they never mention caching, the Strategist redirects them there.

---

## Project Structure

```
architectiq/
  backend/
    api/                  FastAPI route handlers
    services/
      interview_engine.py     Orchestrator — coordinates all layers
      response_analyzer.py    Layer 1 — extract meaning from text
      interview_tracker.py    Layer 2 — deterministic state machine
      interview_strategist.py Layer 3 — priority-based action selection
      interview_speaker.py    Layer 4 — LLM-powered natural speech
      interview_scorer.py     8-dimension rubric scoring (LLM-judged + fallback)
      ollama_client.py        LLM client — Groq + Ollama, with retries + JSON repair
      auth_service.py         JWT, password hashing, OAuth users
    middleware/
      auth.py                 Cookie/Bearer auth dependency
      security.py             Rate limiting, request-size limit, input sanitization
    prompts/
      interviewer_system.md   Core behavioral constraints for the LLM
      personas.py             Level-calibrated interviewer personas
    models/                 Pydantic request/response models
    db/                     SQLite (WAL) + versioned migrations
    tests/                  pytest suite for the engine + auth + db
    config.py               Pydantic Settings configuration

  frontend/
    src/
      app/                  Routes (interview, curriculum, quiz, login, ...)
      lib/api.ts            Central API client (cookie auth + 401 handling)
      store/                Zustand stores (auth, progress, quiz)
      types/                Shared TypeScript types
      components/           UI, diagrams, interview, avatar, ...

  content/
    curriculum.json         Full curriculum tree (7 tiers, 41 modules, 174 lessons)
    challenges/             Problem definitions with rubrics and hints
    knowledge-graphs/       Concept graphs driving the interview strategist
    tier-0/ through tier-6/ Lesson content

  data/
    training/seed/          456 hand-crafted interview conversations for evaluation
    architectiq.db          User progress database

  GO_LIVE.md                Launch plan: integrations, deployment, freemium, payments
  HARDENING_PLAN.md         Backend/frontend hardening notes
```

---

## Development & Testing

**Backend tests** (pytest — covers the deterministic engine, auth, and DB):
```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

**Frontend checks:**
```bash
cd frontend
npx tsc --noEmit     # type-check
npm run build        # production build
```

---

## The Interviewer Prompt System

The LLM receives a ~6KB system prompt on every call that enforces:

**Absolute rules:**
1. Never give the answer — only hints and questions
2. Never exceed 4 sentences
3. Never break character (no "Great question!" or "That's an excellent point!")
4. Never lecture or explain concepts
5. Never repeat what the candidate said
6. Never use AI filler phrases

**Level-specific behavior:**
- SDE2: Hint after 1 pause. Celebrate small wins. Forgive missing capacity estimation.
- Senior: Ask "why" after every decision. Expect trade-off discussion.
- Staff: No hints. Probe failure modes aggressively. Expect 2-3 levels of depth.
- Principal: Ask about team structure, build-vs-buy, migration strategy.
- VP: Start with business context. Discuss compliance, cost modeling, 3-year vision.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand, Framer Motion, D3 |
| Backend | FastAPI, Python 3.11+ |
| LLM | Groq (cloud, default) or Ollama (local) — pluggable via `LLM_PROVIDER` |
| Auth | JWT in an httpOnly cookie; Google + GitHub OAuth |
| Database | SQLite (WAL) + versioned migrations; JSON content |
| Tests | pytest (backend) |
| Deployment | Docker Compose (local); see `GO_LIVE.md` for production |

---

## Status & roadmap

The product features above are built and working. Remaining work to take it live —
LLM capacity, deployment, freemium gating, Razorpay payments, and more — is tracked
in **[`GO_LIVE.md`](./GO_LIVE.md)** and as **GitHub issues** (labeled `P0`/`P1`/`P2`).

---

## License

MIT
