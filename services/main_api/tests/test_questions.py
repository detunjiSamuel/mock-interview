from httpx import AsyncClient
from mock_interview_shared.schemas.enums import Category, Difficulty


async def _seed_question(**kwargs):
    from app.models.question import Question

    defaults: dict = {
        "topic": "Default topic",
        "text": "Describe yourself",
        "difficulty": Difficulty.EASY,
        "category": Category.BEHAVIORAL,
        "slug": "default-topic",
    }
    defaults.update(kwargs)
    q = Question(**defaults)
    await q.insert()
    return q


async def test_list_questions_empty(async_client: AsyncClient) -> None:
    resp = await async_client.get("/api/questions")
    assert resp.status_code == 200
    body = resp.json()
    assert body["questions"] == []
    assert body["pagination"]["total"] == 0


async def test_list_questions_returns_items(async_client: AsyncClient) -> None:
    await _seed_question(slug="q-one", topic="Question one")
    await _seed_question(slug="q-two", topic="Question two")
    resp = await async_client.get("/api/questions")
    assert resp.status_code == 200
    body = resp.json()
    assert body["pagination"]["total"] == 2
    assert len(body["questions"]) == 2


async def test_list_questions_filter_by_category(async_client: AsyncClient) -> None:
    await _seed_question(slug="beh-q", topic="Behavioral", category=Category.BEHAVIORAL)
    await _seed_question(slug="tech-q", topic="Technical", category=Category.TECHNICAL)
    resp = await async_client.get("/api/questions?category=behavioral")
    assert resp.status_code == 200
    body = resp.json()
    assert body["pagination"]["total"] == 1
    assert body["questions"][0]["category"] == "behavioral"


async def test_list_questions_filter_by_difficulty(async_client: AsyncClient) -> None:
    await _seed_question(slug="easy-q", topic="Easy question", difficulty=Difficulty.EASY)
    await _seed_question(slug="hard-q", topic="Hard question", difficulty=Difficulty.HARD)
    resp = await async_client.get("/api/questions?difficulty=easy")
    assert resp.status_code == 200
    body = resp.json()
    assert body["pagination"]["total"] == 1
    assert body["questions"][0]["difficulty"] == "easy"


async def test_get_question_by_slug(async_client: AsyncClient) -> None:
    await _seed_question(slug="my-slug", topic="My topic", text="Tell me about yourself")
    resp = await async_client.get("/api/questions/my-slug")
    assert resp.status_code == 200
    body = resp.json()
    assert body["slug"] == "my-slug"
    assert body["topic"] == "My topic"
    assert body["text"] == "Tell me about yourself"


async def test_get_question_not_found(async_client: AsyncClient) -> None:
    resp = await async_client.get("/api/questions/nonexistent-slug")
    assert resp.status_code == 404
