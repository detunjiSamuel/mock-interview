import json
import aio_pika
from aio_pika.abc import AbstractChannel
from mock_interview_shared.schemas.messages import TranscriptRequest
from mock_interview_shared.schemas.enums import Difficulty, Category


async def publish_transcript_request(
    channel: AbstractChannel,
    interview_id: str,
    recording_path: str,
    question_text: str,
    difficulty: Difficulty | None = None,
    category: Category | None = None,
) -> None:
    request = TranscriptRequest(
        interview=interview_id,
        recording_path=recording_path,
        question=question_text,
        difficulty=difficulty,
        category=category,
    )
    body = request.model_dump_json(by_alias=True).encode()
    message = aio_pika.Message(
        body=body,
        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        content_type="application/json",
    )
    await channel.default_exchange.publish(
        message,
        routing_key="transcript_processing",
    )
