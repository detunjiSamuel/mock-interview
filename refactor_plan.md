# Mock Interview Platform — Refactor Plan

## Context

The platform is a mock interview tool for new graduates: users pick a question, record an audio answer, and receive AI-generated feedback. It was built as a learning project with a Node.js/Express main API, two Python Flask workers (transcript + feedback), and a Next.js frontend. It recently migrated off Google Cloud Functions to self-hosted RabbitMQ. There are zero tests, the feedback service has a broken OpenAI call, and the architecture mixes two languages without a clear convention. The goal is a Python-only backend using a clean microservices structure, proper tests, and a more sensible frontend.

---

## FastAPI vs Django — The Defence

**FastAPI wins.** Here is why:

| Concern | FastAPI | Django |
|---|---|---|
| Microservices fit | Each service is 1 thing — FastAPI's lightweight router is all you need | Django's batteries (admin, ORM, migrations) are overhead you don't use |
| Async I/O | Native `async/await`; pairs with `motor`/`aio-pika` for non-blocking DB + queue work | ASGI support exists but is bolted on; sync-by-default ORM |
| Validation & docs | Pydantic models auto-generate OpenAPI/Swagger with zero extra code | DRF serializers are a second layer on top of models |
| Performance | Fast enough — bottleneck is always OpenAI API calls (500ms–3s), not the HTTP layer | Noticeably slower with no compensating benefit |
| Existing code | Two Python Flask workers already live here — FastAPI is their natural upgrade | A full Django rewrite would throw away working patterns |
| Type safety | Full Python type hints throughout; `mypy` catches errors at write-time | Typing support exists but isn't enforced by the framework |

**On Node.js being faster in benchmarks:** True — Fastify benchmarks ~77k req/s vs FastAPI ~50k req/s. But that gap is irrelevant here. The bottleneck is always the OpenAI API call, never the HTTP router. At this application's scale, FastAPI is more than fast enough, and keeping Python everywhere (one language, one test runner, one linter, shared package for MQ schemas) outweighs a speed advantage that will never be felt.

Django would win if: you needed its admin panel for content management, or had deeply relational data requiring migrations. MongoDB + a learning-project data model needs neither.

---

## Target Architecture

```
mock-interview/
├── shared/                  # Pip-installable package: Pydantic MQ schemas + utils
├── services/
│   ├── main_api/            # FastAPI — auth, questions, interviews, file upload
│   ├── transcript_service/  # Async worker — consumes queue, calls OpenAI Whisper
│   └── feedback_service/    # Async worker — consumes queue, calls GPT-4o
├── client/                  # Next.js — modernised frontend
├── docker-compose.yml
├── docker-compose.dev.yml   # hot-reload mounts
├── .env.example
└── Makefile                 # make dev / make test / make lint
```

**Hard rule — `uv` everywhere:**
All Python dependency management, virtual environments, script execution, and tooling must use [`uv`](https://github.com/astral-sh/uv). No `pip`, `pip-tools`, `virtualenv`, or `pyenv` anywhere in the project. This applies in local development, CI, and Docker. `uv` is the single source of truth for Python versions and lockfiles.

**Key tech choices:**
- FastAPI + Pydantic v2 — all services
- Beanie (async ODM on Motor) — Pydantic-native MongoDB, replaces Mongoose
- aio-pika — async RabbitMQ, replaces blocking pika
- pydantic-settings — typed env config per service
- python-jose + passlib[bcrypt] — JWT auth
- pytest + httpx (AsyncClient) — tests; run via `uv run pytest`
- shadcn/ui + TanStack Query + react-hook-form/zod — frontend
- Server-Sent Events (SSE) — replaces 5-second polling for feedback
- OpenAI Realtime API (Phase 8) — live conversational interview mode

---

## Refactor Plan

### Phase 0 — Repo Housekeeping & Tooling
- [ ] Rename `main-api/` → `services/main_api/`, `independent-services/transcipt-gen-service/` → `services/transcript_service/`, `independent-services/feedback-gen-service/` → `services/feedback_service/`, `interview-mock-client/` → `client/`
- [ ] Install `uv` globally; add `uv` version pin to `.python-version` at repo root
- [ ] Create `shared/` Python package with `pyproject.toml`; add as workspace member — installed in other services via `uv add --editable ../shared` (not `pip install -e`)
- [ ] Each service gets its own `pyproject.toml`; run `uv sync` to create `.venv` and `uv.lock` per service
- [ ] Dev deps (black, ruff, mypy, pytest, httpx) declared under `[dependency-groups]` in each `pyproject.toml` and installed with `uv sync --group dev`
- [ ] Add `pre-commit` config: hooks run via `uv run ruff check`, `uv run black --check`, `uv run mypy`
- [ ] Add root `Makefile`: `make dev` → `uv sync` in each service; `make test` → `uv run pytest`; `make lint` → `uv run ruff check && uv run black --check`; `make build` → docker compose build
- [ ] Update `.gitignore`: add `.venv/`, `uv.lock` is committed (lockfile), `__pycache__/`, `*.egg-info/`, `.mypy_cache/`
- [ ] Create `.env.example` documenting all required variables across all services

---

### Phase 1 — Shared Package (`shared/`)
- [ ] `shared/schemas/messages.py` — Pydantic models for all RabbitMQ payloads (TranscriptRequest, TranscriptResult, FeedbackRequest, FeedbackResult)
- [ ] `shared/schemas/enums.py` — MessageType, Difficulty, Category enums
- [ ] `shared/mq/client.py` — aio-pika connection factory (connect, channel, declare queues) shared by all services
- [ ] `shared/utils/logging.py` — structured JSON logging config (replaces per-service copies)
- [ ] Tests: `shared/tests/test_schemas.py` — validate all message schemas round-trip correctly

---

### Phase 2 — Main API (`services/main_api/`)
**Structure:**
```
app/
├── main.py           # FastAPI app + lifespan (DB + MQ startup/shutdown)
├── config.py         # pydantic-settings BaseSettings
├── dependencies.py   # get_current_user, get_mq_channel
├── routers/
│   ├── auth.py       # POST /api/auth/register, /login, GET /api/auth/profile
│   ├── questions.py  # GET /api/questions, /api/questions/{slug}
│   ├── interviews.py # POST /api/submit-recording, GET /api/interviews/{id}/feedback, SSE stream
│   └── internal.py   # POST /api/internal/submit-result (service callback)
├── models/           # Beanie Documents (User, Question, Interview)
├── schemas/          # Pydantic request/response shapes
└── services/
    ├── auth.py       # hash_password, verify_password, create_token, decode_token
    ├── files.py      # save_upload, resolve_path (FileStorage protocol)
    └── mq_publisher.py  # publish_transcript_request
```

- [ ] Bootstrap FastAPI app with Beanie init (Motor connection) in lifespan
- [ ] `models/user.py` — Beanie Document: email (unique), hashed_password, created_at
- [ ] `models/question.py` — Beanie Document: topic, text, helpful_tip, difficulty (enum), category (enum), slug (unique), video_url
- [ ] `models/interview.py` — Beanie Document: user ref, question ref, audio_url, audio_transcript, feedback, status (enum: pending/processing/done/failed), created_at
- [ ] `routers/auth.py` — register (hash password, return JWT), login (verify + JWT), profile (auth required)
- [ ] `routers/questions.py` — list (pagination + filter by category/difficulty/search), get by slug; include `has_attempted` flag when user is authenticated
- [ ] `routers/interviews.py` — submit-recording (multipart, saves file, creates Interview doc, publishes to MQ), get feedback, SSE stream endpoint for live feedback delivery
- [ ] `routers/internal.py` — secured endpoint (shared secret header) to receive results from worker services; updates Interview doc + triggers SSE push
- [ ] `services/files.py` — abstract file save/read behind a `FileStorage` protocol (local disk now, easy to swap to S3 later)
- [ ] Seed script: `scripts/seed_questions.py` — reads the xlsx and upserts questions (replaces `/api/dev/add-questions`)

---

### Phase 3 — Transcript Service (`services/transcript_service/`)
- [ ] Replace Flask + blocking pika with `asyncio` event loop + `aio-pika`
- [ ] `app/worker.py` — connect to RabbitMQ, consume `transcript_processing` queue
- [ ] `app/handlers/transcript.py` — deserialise message (using shared schema), call Whisper, publish transcript to `processing_results` queue + forward to `feedback_processing` queue
- [ ] `app/services/whisper.py` — async wrapper around `openai.audio.transcriptions.create`
- [ ] Add `/health` HTTP endpoint (minimal FastAPI app alongside worker via `asyncio.gather`)
- [ ] Dockerfile: use `ghcr.io/astral-sh/uv` as build base; copy `pyproject.toml` + `uv.lock`, run `uv sync --frozen --no-dev` for reproducible installs; no pip, no requirements.txt

---

### Phase 4 — Feedback Service (`services/feedback_service/`)
- [ ] Fix broken call: replace `client.responses.create()` with `client.chat.completions.create()` (GPT-4o)
- [ ] Replace Flask + blocking pika with `asyncio` + `aio-pika`
- [ ] `app/worker.py` — consume `feedback_processing` queue
- [ ] `app/handlers/feedback.py` — deserialise, call GPT-4o with structured prompt, publish feedback result to `processing_results`
- [ ] `app/services/ai.py` — async GPT-4o call; structured Pydantic output: overall_impression, strengths, areas_for_improvement, suggestions, score
- [ ] Remove `google-cloud-error-reporting` dependency
- [ ] Add `/health` endpoint
- [ ] Dockerfile: same `uv`-based pattern as transcript service — `uv sync --frozen --no-dev`, no pip

---

### Phase 5 — Tests
**Main API (`services/main_api/tests/`):**
- [ ] `conftest.py` — pytest fixtures: `async_client` (httpx AsyncClient), `test_db` (mongomock + Beanie), `auth_headers` helper
- [ ] `test_auth.py` — register (happy path, duplicate email), login (valid, wrong password), profile (auth required)
- [ ] `test_questions.py` — list (pagination, filters), get by slug (found, not found)
- [ ] `test_interviews.py` — submit recording (auth required, file stored, MQ message published), get feedback (pending, done states)
- [ ] `test_internal.py` — internal result callback (valid secret, invalid secret)

**Transcript service (`services/transcript_service/tests/`):**
- [ ] `test_handler.py` — mock OpenAI + MQ, assert correct messages published on success and failure
- [ ] `test_whisper.py` — mock OpenAI client, assert transcript extracted correctly

**Feedback service (`services/feedback_service/tests/`):**
- [ ] `test_handler.py` — mock OpenAI + MQ, assert structured feedback published
- [ ] `test_ai.py` — mock GPT-4o response, assert Pydantic model parsed correctly

**Shared (`shared/tests/`):**
- [ ] `test_schemas.py` — all message models serialise/deserialise correctly

---

### Phase 6 — Frontend (`client/`)
- [ ] Upgrade Next.js to 14+ (App Router, already in use)
- [ ] Install shadcn/ui — configure component library (Button, Input, Select, Card, Badge, Skeleton)
- [ ] Install TanStack Query v5 — wrap app in `QueryClientProvider`, replace raw `fetch` calls
- [ ] Create `lib/api-client.ts` — central Axios instance with base URL + JWT interceptor
- [ ] Install react-hook-form + zod — refactor login and register forms with schema validation
- [ ] Replace 5-second polling with SSE (`EventSource`) on `/api/interviews/{id}/stream`
- [ ] Refactor `AuthContext` — persist token in httpOnly cookie via Next.js API route (XSS hardening, out of localStorage)
- [ ] Add Skeleton loading states throughout
- [ ] Add `useQuery` hooks for questions list + question detail with cache invalidation
- [ ] Add error boundary at root layout
- [ ] Add `/dashboard` page — user's interview history with scores and feedback summaries

---

### Phase 7 — Docker & Production Hardening
- [ ] Update `docker-compose.yml` — fix feedback-service (currently commented out), use `depends_on.condition: service_healthy`
- [ ] Add `docker-compose.dev.yml` — volume mounts for hot-reload in all services
- [ ] Add Docker health checks to all services (via `/health` endpoints)
- [ ] Add `INTERNAL_API_SECRET` env var for service-to-service auth (replaces `app_id` string check)
- [ ] Add structured JSON logging across all services with per-request correlation IDs
- [ ] Write GitHub Actions workflow: install `uv` via `astral-sh/setup-uv@v4`; lint (`uv run ruff check && uv run black --check`) → test (`uv run pytest`) → build Docker images on push to `main`; cache `uv`'s cache dir between runs
- [ ] Update `README.md` with setup instructions, architecture diagram reference, env var docs

---

### Phase 8 — Real-Time Interview Sessions (Live Mode)

Replaces "record → upload → wait" with a live, conversational interview experience. The user speaks directly to an AI interviewer that listens, responds, and asks follow-up questions in real time.

**Architecture:**
- OpenAI **Realtime API** (WebSocket-based, streaming audio in / streaming audio out) acts as the AI interviewer
- FastAPI main API acts as a **proxy/session manager** — opens a WebSocket to OpenAI Realtime and relays audio between client and OpenAI
- Frontend streams microphone audio over WebSocket to the backend; receives and plays AI audio back
- Session transcript stored in MongoDB at end of interview; feedback generation triggered automatically

**Tasks:**
- [ ] Design `InterviewSession` model — session_id, user, question, messages (role/content/timestamp array), status (active/completed), created_at
- [ ] `routers/realtime.py` — WebSocket endpoint `/api/interviews/live/{question_slug}` proxying to OpenAI Realtime API
- [ ] `services/realtime_proxy.py` — bidirectional WebSocket relay; injects system prompt (question + interviewer persona) on session start; saves transcript on end
- [ ] System prompt: AI persona as professional interviewer — opens with the question, listens actively, asks one follow-up, signals completion verbally
- [ ] Frontend: `LiveInterview` component — WebAudio API microphone capture, WebSocket streaming, AudioContext playback of AI audio
- [ ] Frontend: session controls — Start, End Session, mute toggle, live scrolling transcript
- [ ] Post-session: trigger async feedback via existing feedback service (transcript as input instead of Whisper output)
- [ ] Keep old "record and submit" flow as fallback (offline prep / poor connectivity)
- [ ] Tests: `test_realtime.py` — mock OpenAI Realtime WebSocket, assert session lifecycle (start → exchange → end → transcript saved)

---

## Verification

After each phase:
1. `docker compose up` — all services healthy
2. Register a user, log in, browse questions
3. Record and submit an answer; confirm SSE delivers feedback without polling
4. `make test` — all suites pass
5. `make lint` — no errors
