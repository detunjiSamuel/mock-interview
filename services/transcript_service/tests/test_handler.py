import json
from unittest.mock import AsyncMock, MagicMock, patch

import aio_pika
import pytest

from app.config import Settings
from app.handlers.transcript import handle

_SETTINGS = Settings(
    openai_api_key="fake-key",
    rabbitmq_uri="amqp://guest:guest@localhost/",
)

_VALID_REQUEST = {
    "interview": "interview-123",
    "recording_path": "audio/test.mp3",
    "question": "Tell me about yourself",
}


@pytest.mark.asyncio
async def test_handle_publishes_transcript_and_feedback_request() -> None:
    published: list[tuple[str, bytes]] = []

    async def fake_publish(message: aio_pika.Message, *, routing_key: str) -> None:
        published.append((routing_key, message.body))

    mock_exchange = AsyncMock()
    mock_exchange.publish = fake_publish

    mock_channel = MagicMock()
    mock_channel.default_exchange = mock_exchange

    raw = aio_pika.Message(body=json.dumps(_VALID_REQUEST).encode())

    with patch("app.handlers.transcript.transcribe", new=AsyncMock(return_value="mock transcript")):
        await handle(raw, mock_channel, _SETTINGS)

    routing_keys = [rk for rk, _ in published]
    assert "results_to_main_api" in routing_keys
    assert "feedback_processing" in routing_keys

    result_body = next(body for rk, body in published if rk == "results_to_main_api")
    result_data = json.loads(result_body)
    assert result_data["type"] == "transcript"
    assert result_data["transcript"] == "mock transcript"
    assert result_data["interview"] == "interview-123"

    feedback_body = next(body for rk, body in published if rk == "feedback_processing")
    feedback_data = json.loads(feedback_body)
    assert feedback_data["interview"] == "interview-123"
    assert feedback_data["transcript"] == "mock transcript"
