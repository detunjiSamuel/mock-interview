from httpx import AsyncClient
from mock_interview_shared.schemas.enums import Category, Difficulty, InterviewStatus

INTERNAL_HEADERS = {"X-Internal-Secret": "test-internal-secret"}
BAD_HEADERS = {"X-Internal-Secret": "wrong-secret"}


async def _seed_user(email: str = "internal-user@example.com"):
    from app.models.user import User
    from app.services.auth import hash_password

    user = User(email=email, hashed_password=hash_password("secret"))
    await user.insert()
    return user


async def _seed_question(slug: str = "internal-q"):
    from app.models.question import Question

    q = Question(
        topic="Internal topic",
        text="Tell me about a challenge",
        difficulty=Difficulty.MEDIUM,
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


async def test_submit_transcript_result(async_client: AsyncClient) -> None:
    from app.models.interview import Interview

    user = await _seed_user("t-transcript@example.com")
    question = await _seed_question("t-transcript-q")
    interview = await _seed_interview(user, question)

    resp = await async_client.post(
        "/api/internal/submit-result",
        headers=INTERNAL_HEADERS,
        json={
            "type": "transcript",
            "interview": str(interview.id),
            "transcript": "Hello world",
            "app_id": "test-app",
            "question": "Tell me about yourself",
        },
    )
    assert resp.status_code == 200

    updated = await Interview.get(interview.id)
    assert updated is not None
    assert updated.status == InterviewStatus.PROCESSING
    assert updated.audio_transcript == "Hello world"


async def test_submit_feedback_result(async_client: AsyncClient) -> None:
    from app.models.interview import Interview

    user = await _seed_user("t-feedback@example.com")
    question = await _seed_question("t-feedback-q")
    interview = await _seed_interview(user, question)

    resp = await async_client.post(
        "/api/internal/submit-result",
        headers=INTERNAL_HEADERS,
        json={
            "type": "feedback",
            "interview": str(interview.id),
            "feedback": {
                "overall_impression": "Great job",
                "strengths": ["clear communication"],
                "areas_for_improvement": ["use more examples"],
                "suggestions": ["apply STAR method"],
                "score": 8,
            },
            "app_id": "test-app",
        },
    )
    assert resp.status_code == 200

    updated = await Interview.get(interview.id)
    assert updated is not None
    assert updated.status == InterviewStatus.DONE
    assert updated.feedback is not None


async def test_submit_result_wrong_secret(async_client: AsyncClient) -> None:
    user = await _seed_user("t-wrong@example.com")
    question = await _seed_question("t-wrong-q")
    interview = await _seed_interview(user, question)

    resp = await async_client.post(
        "/api/internal/submit-result",
        headers=BAD_HEADERS,
        json={
            "type": "transcript",
            "interview": str(interview.id),
            "transcript": "test",
            "app_id": "x",
            "question": "q",
        },
    )
    assert resp.status_code == 403


async def test_submit_result_invalid_id(async_client: AsyncClient) -> None:
    resp = await async_client.post(
        "/api/internal/submit-result",
        headers=INTERNAL_HEADERS,
        json={
            "type": "transcript",
            "interview": "notanobjectid",
            "transcript": "test",
            "app_id": "x",
            "question": "q",
        },
    )
    assert resp.status_code == 400


async def test_submit_result_not_found(async_client: AsyncClient) -> None:
    resp = await async_client.post(
        "/api/internal/submit-result",
        headers=INTERNAL_HEADERS,
        json={
            "type": "transcript",
            "interview": "000000000000000000000000",
            "transcript": "test",
            "app_id": "x",
            "question": "q",
        },
    )
    assert resp.status_code == 404
