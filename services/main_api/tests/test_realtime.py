"""Tests for Phase 8: Realtime WebSocket interview session feature."""

import json
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from bson import ObjectId
from mongomock_motor import AsyncMongoMockClient
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from mock_interview_shared.schemas.enums import Category, Difficulty, SessionStatus

from tests.conftest import _patched_load_cached_info

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _make_token(email: str) -> str:
    from app.services.auth import create_token

    return create_token(email, "test-secret-key-for-pytest", "HS256", 2)


async def _seed_user(email: str):
    from app.models.user import User
    from app.services.auth import hash_password

    user = User(email=email, hashed_password=hash_password("secret123"))
    await user.insert()
    return user


async def _seed_question(slug: str):
    from app.models.question import Question

    q = Question(
        topic="Realtime Test",
        text="Tell me about yourself.",
        difficulty=Difficulty.EASY,
        category=Category.BEHAVIORAL,
        slug=slug,
    )
    await q.insert()
    return q


# ─────────────────────────────────────────────────────────────────────────────
# Fake OpenAI WebSocket helpers
# ─────────────────────────────────────────────────────────────────────────────


class _FakeOpenAIWs:
    """Yields one assistant message then closes (simulates a minimal session)."""

    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send(self, data: str) -> None:
        self.sent.append(data)

    def __aiter__(self):  # type: ignore[override]
        return self._messages()

    async def _messages(self):
        yield json.dumps(
            {
                "type": "conversation.item.created",
                "item": {
                    "role": "assistant",
                    "content": [{"type": "text", "text": "Tell me about yourself."}],
                },
            }
        )


@asynccontextmanager
async def _fake_ws_connect(*args, **kwargs):  # type: ignore[misc]
    yield _FakeOpenAIWs()


class _FailingCtx:
    """Raises immediately on __aenter__ to simulate a failed OpenAI connection."""

    async def __aenter__(self):
        raise ConnectionError("Simulated OpenAI connection failure")

    async def __aexit__(self, *args) -> None:
        pass


def _failing_ws_connect(*args, **kwargs):  # type: ignore[misc]
    return _FailingCtx()


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def realtime_db():
    """
    Initialize Beanie with all models including InterviewSession.
    Yields the raw AsyncMongoMockClient so ws_app can pass it back to the
    app's lifespan (keeping a single shared in-memory store).
    """
    import beanie
    from beanie.odm.utils.init import Initializer
    from app.models.interview import Interview
    from app.models.question import Question
    from app.models.session import InterviewSession
    from app.models.user import User

    client = AsyncMongoMockClient()
    with patch.object(Initializer, "_load_cached_info", _patched_load_cached_info):
        await beanie.init_beanie(
            database=client["testdb"],
            document_models=[User, Question, Interview, InterviewSession],
        )
    yield client
    await User.find_all().delete()
    await Question.find_all().delete()
    await InterviewSession.find_all().delete()


@pytest_asyncio.fixture
async def ws_app(realtime_db):
    """
    Provide a synchronous Starlette TestClient with:
      - Beanie already initialised (via realtime_db, same in-memory client)
      - Motor, MQ connection, and queue-declaration startup calls patched out
    Yields (TestClient, mock_mq_connection).
    """
    mock_mq = AsyncMock()
    mock_channel = AsyncMock()
    mock_channel.default_exchange = AsyncMock()
    mock_mq.channel = AsyncMock(return_value=mock_channel)

    with (
        patch("app.main.AsyncIOMotorClient", return_value=realtime_db),
        patch("beanie.init_beanie", new=AsyncMock()),
        patch("app.main.get_connection", return_value=mock_mq),
        patch("app.main.declare_queues", new=AsyncMock()),
    ):
        from app.main import app

        with TestClient(app, raise_server_exceptions=True) as client:
            app.state.mq_connection = mock_mq
            yield client, mock_mq


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────


async def test_live_interview_requires_auth(ws_app) -> None:
    """No token → server closes immediately after accepting with code 1008."""
    client, _ = ws_app
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/api/interviews/live/some-slug") as ws:
            ws.receive_json()
    assert exc_info.value.code == 1008


async def test_live_interview_question_not_found(ws_app) -> None:
    """Valid auth but unknown slug → error JSON frame, then WS 1008."""
    client, _ = ws_app
    user = await _seed_user("qnotfound@example.com")
    token = _make_token(user.email)

    with client.websocket_connect(f"/api/interviews/live/no-such-slug?token={token}") as ws:
        error_msg = ws.receive_json()
        assert error_msg["type"] == "error"
        assert "not found" in error_msg["detail"].lower()

        with pytest.raises(WebSocketDisconnect) as exc_info:
            ws.receive_json()
    assert exc_info.value.code == 1008


async def test_live_interview_session_created(ws_app) -> None:
    """
    Happy path: session is created, proxy proxies one message from the fake
    OpenAI WS, then finishes.  The DB should contain a COMPLETED session with
    one assistant message.
    """
    client, _ = ws_app
    user = await _seed_user("session@example.com")
    await _seed_question("session-q")
    token = _make_token(user.email)

    with (
        patch("app.services.realtime_proxy.ws_connect", _fake_ws_connect),
        patch("app.services.realtime_proxy._publish_feedback", new=AsyncMock()),
    ):
        with client.websocket_connect(f"/api/interviews/live/session-q?token={token}") as ws:
            # First frame: session acknowledged
            first = ws.receive_json()
            assert first["type"] == "session_created"
            session_id = first["session_id"]
            assert session_id

            # Second frame: OpenAI message forwarded verbatim to the browser
            forwarded = ws.receive_json()
            assert forwarded["type"] == "conversation.item.created"

    # After the WS context exits, thread.join() guarantees the handler has
    # finished, so the DB write has already committed.
    from app.models.session import InterviewSession

    session = await InterviewSession.get(ObjectId(session_id))
    assert session is not None
    assert session.status == SessionStatus.COMPLETED
    assert len(session.messages) == 1
    assert session.messages[0].role == "assistant"


async def test_live_interview_openai_failure(ws_app) -> None:
    """
    If the OpenAI WebSocket raises on connect, the proxy catches it,
    sends an error frame to the browser, and saves the session as FAILED.
    """
    client, _ = ws_app
    user = await _seed_user("failure@example.com")
    await _seed_question("failure-q")
    token = _make_token(user.email)

    with patch("app.services.realtime_proxy.ws_connect", _failing_ws_connect):
        with client.websocket_connect(f"/api/interviews/live/failure-q?token={token}") as ws:
            # Session is created before the proxy attempt
            first = ws.receive_json()
            assert first["type"] == "session_created"
            session_id = first["session_id"]

            # Proxy failure sends an error frame
            error_msg = ws.receive_json()
            assert error_msg["type"] == "error"
            assert "OpenAI connection failed" in error_msg["detail"]

    # DB should reflect the failure
    from app.models.session import InterviewSession

    session = await InterviewSession.get(ObjectId(session_id))
    assert session is not None
    assert session.status == SessionStatus.FAILED
