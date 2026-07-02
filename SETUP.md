# Running the Mock Interview Platform

## Prerequisites

- Docker and Docker Compose installed
- An OpenAI API key

---

## 1. Configure environment variables

Copy the example file and fill in the required values:

```bash
cp .env.example .env
```

Open `.env` and set:

```
JWT_SECRET=<random 32-byte hex — generate with: openssl rand -hex 32>
INTERNAL_API_SECRET=<random 32-byte hex — generate with: openssl rand -hex 32>
OPENAI_API_KEY=<your OpenAI API key>
```

The remaining values (Mongo credentials, RabbitMQ credentials) have safe defaults and do not need to change for local development.

**Running in GitHub Codespaces?** Add these two lines so the frontend and API are reachable from the browser:

```
NEXT_PUBLIC_API_URL=https://<codespace-name>-8000.app.github.dev
CORS_ORIGINS=["http://localhost:3000","https://<codespace-name>-3000.app.github.dev"]
```

Replace `<codespace-name>` with the value of `echo $CODESPACE_NAME` in your terminal.

---

## 2. Build and start all services

```bash
docker compose build
docker compose up -d
```

Wait about 30 seconds for all health checks to pass, then verify:

```bash
docker compose ps
```

All six services should show `(healthy)` or `Up`:

| Container | Role |
|-----------|------|
| `interview-mongodb` | Database |
| `interview-rabbitmq` | Message queue |
| `interview-main-api` | FastAPI backend (port 8000) |
| `interview-transcript-service` | Whisper worker |
| `interview-feedback-service` | GPT-4o worker |
| `interview-frontend` | Next.js frontend (port 3000) |

---

## 3. Seed the question bank

Run this once after the first start (and any time you want to reset the questions):

```bash
docker exec interview-main-api uv run python scripts/seed_questions.py
```

You should see 15 questions inserted.

---

## 4. Open the app

- **Local:** http://localhost:3000
- **Codespace:** `https://<codespace-name>-3000.app.github.dev`

Register an account, log in, and start practising.

---

## Stopping and restarting

```bash
# Stop without losing data
docker compose down

# Stop and wipe all data (clean slate)
docker compose down -v

# Restart after a clean wipe — repeat steps 2 and 3
docker compose build
docker compose up -d
docker exec interview-main-api uv run python scripts/seed_questions.py
```

---

## Useful commands

```bash
# Stream logs from all services
docker compose logs -f

# Stream logs from one service
docker compose logs -f main-api

# Re-run linters
make lint

# Run test suite
make test
```
