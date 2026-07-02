import logging
import os

import aio_pika
from aio_pika.abc import AbstractChannel, AbstractIncomingMessage

from mock_interview_shared.schemas.messages import FeedbackRequest, TranscriptRequest, TranscriptResult

from ..config import Settings
from ..services.whisper import transcribe

logger = logging.getLogger(__name__)


async def handle(message: AbstractIncomingMessage, channel: AbstractChannel, settings: Settings) -> None:
    async with message.process(requeue=False):
        req = TranscriptRequest.model_validate_json(message.body)
        audio_path = os.path.join(settings.storage_path, req.recording_path)

        transcript = await transcribe(audio_path, settings.openai_api_key)

        result = TranscriptResult(
            interview_id=req.interview_id,
            transcript=transcript,
            app_id=settings.app_id,
            question=req.question,
        )
        await channel.default_exchange.publish(
            aio_pika.Message(body=result.model_dump_json(by_alias=True).encode()),
            routing_key="results_to_main_api",
        )

        feedback_req = FeedbackRequest(
            interview_id=req.interview_id,
            transcript=transcript,
            question=req.question,
            difficulty=req.difficulty,
            category=req.category,
        )
        await channel.default_exchange.publish(
            aio_pika.Message(body=feedback_req.model_dump_json(by_alias=True).encode()),
            routing_key="feedback_processing",
        )

        logger.info("Processed transcript for interview %s", req.interview_id)
