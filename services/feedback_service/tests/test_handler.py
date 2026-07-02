import json
from unittest.mock import AsyncMock, MagicMock, patch

import aio_pika
import pytest

from mock_interview_shared.schemas.messages import FeedbackScore
from app.config import Settings
from app.handlers.feedback import handle

_SETTINGS = Settings(
    openai_api_key="fake-key",
    rabbitmq_uri="amqp://guest:guest@localhost/",
)

_VALID_REQUEST = {
    "interview": "interview-456",
    "transcript": "Polymorphism means many forms...",
    "question": "What is polymorphism?",
}

_MOCK_SCORE = FeedbackScore(
    overall_impression="Solid answer.",
    strengths=["Clear definition", "Good example"],
    areas_for_improvement=["Add more depth"],
    suggestions=["Mention duck typing"],
    score=8,
)


@pytest.mark.asyncio
async def test_handle_publishes_feedback_result() -> None:
    published: list[tuple[str, bytes]] = []

    async def fake_publish(message: aio_pika.Message, *, routing_key: str) -> None:
        published.append((routing_key, message.body))

    mock_exchange = AsyncMock()
    mock_exchange.publish = fake_publish

    mock_channel = MagicMock()
    mock_channel.default_exchange = mock_exchange

    raw = aio_pika.Message(body=json.dumps(_VALID_REQUEST).encode())

    with patch("app.handlers.feedback.generate_feedback", new=AsyncMock(return_value=_MOCK_SCORE)):
        await handle(raw, mock_channel, _SETTINGS)

    assert len(published) == 1
    routing_key, body = published[0]
    assert routing_key == "results_to_main_api"

    data = json.loads(body)
    assert data["type"] == "feedback"
    assert data["interview"] == "interview-456"
    assert data["feedback"]["score"] == 8
    assert data["feedback"]["overall_impression"] == "Solid answer."
