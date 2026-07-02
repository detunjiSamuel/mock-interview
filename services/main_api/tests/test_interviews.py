import io
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient
from mock_interview_shared.schemas.enums import Category, Difficulty

from tests.conftest import make_auth_headers


async def _seed_user(email: str = "user@example.com", password: str = "secret123"):
    from app.models.user import User
    from app.services.auth import hash_password

    user = User(email=email, hashed_password=hash_password(password))
    await user.insert()
    return user


async def _seed_question(slug: str = "default-q"):
    from app.models.question import Question

    q = Question(
        topic="Default topic",
        text="Describe yourself",
        difficulty=Difficulty.EASY,
        category=Category.BEHAVIORAL,
        slug=slug,
    )
    await q.insert()
    return q


async def _seed_interview(user, question):
    from app.models.interview import Interview
    from beanie import WriteRules

    interview = Interview(user=user, question=question, audio_url="audio.webm")
    await interview.insert(link_rule=WriteRules.DO_NOTHING)
    return interview


async def test_submit_recording_requires_auth(async_client: AsyncClient) -> None:
    resp = await async_client.post(
        "/api/interviews/submit-recording",
        data={"question_id": "some-slug"},
        files={"audio_response": ("test.webm", io.BytesIO(b"fake"), "audio/webm")},
    )
    assert resp.status_code == 401


async def test_submit_recording_creates_interview(async_client: AsyncClient) -> None:
    user = await _seed_user("submit@example.com")
    await _seed_question("submit-q")

    with patch(
        "app.routers.interviews._file_storage.save",
        new=AsyncMock(return_value="fake-audio.webm"),
    ):
        resp = await async_client.post(
            "/api/interviews/submit-recording",
            data={"question_id": "submit-q"},
            files={"audio_response": ("test.webm", io.BytesIO(b"fake audio"), "audio/webm")},
            headers=make_auth_headers(user.email),
        )

    assert resp.status_code == 200
    body = resp.json()
    assert "interview" in body
    assert len(body["interview"]) == 24


async def test_get_feedback_pending(async_client: AsyncClient) -> None:
    user = await _seed_user("pending@example.com")
    question = await _seed_question("pending-q")
    interview = await _seed_interview(user, question)

    resp = await async_client.get(
        f"/api/interviews/{interview.id}/feedback",
        headers=make_auth_headers(user.email),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["interview"]["status"] == "pending"


async def test_get_feedback_requires_auth(async_client: AsyncClient) -> None:
    resp = await async_client.get("/api/interviews/000000000000000000000001/feedback")
    assert resp.status_code == 401


async def test_get_feedback_ownership(async_client: AsyncClient) -> None:
    user1 = await _seed_user("owner@example.com")
    user2 = await _seed_user("intruder@example.com")
    question = await _seed_question("ownership-q")
    interview = await _seed_interview(user1, question)

    resp = await async_client.get(
        f"/api/interviews/{interview.id}/feedback",
        headers=make_auth_headers(user2.email),
    )
    assert resp.status_code == 403


async def test_get_feedback_invalid_id(async_client: AsyncClient) -> None:
    user = await _seed_user("invalid@example.com")
    resp = await async_client.get(
        "/api/interviews/notanobjectid/feedback",
        headers=make_auth_headers(user.email),
    )
    assert resp.status_code == 400
