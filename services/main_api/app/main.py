from contextlib import asynccontextmanager
from typing import AsyncGenerator

import beanie
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from mock_interview_shared.mq.client import declare_queues, get_connection

from .config import settings
from .logging_config import CorrelationIDMiddleware, configure_logging
from .models.interview import Interview
from .models.question import Question
from .models.user import User
from .routers import auth, internal, interviews, questions

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ── Startup ──────────────────────────────────────────────────────────
    motor_client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongo_uri)
    db_name = settings.mongo_uri.rsplit("/", 1)[-1].split("?")[0]
    await beanie.init_beanie(
        database=motor_client[db_name],
        document_models=[User, Question, Interview],
    )

    mq_connection = await get_connection(settings.rabbitmq_uri)
    app.state.mq_connection = mq_connection
    # Declare all queues once at startup so publishers never silently drop messages
    _channel = await mq_connection.channel()
    await declare_queues(_channel)
    await _channel.close()

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────
    await mq_connection.close()
    motor_client.close()


app = FastAPI(title="Mock Interview API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(CorrelationIDMiddleware)

# Routers
app.include_router(auth.router, prefix="/api")
app.include_router(questions.router, prefix="/api")
app.include_router(interviews.router, prefix="/api")
app.include_router(internal.router, prefix="/api")


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok"}
