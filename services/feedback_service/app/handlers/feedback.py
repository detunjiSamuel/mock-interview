import logging

import aio_pika
from aio_pika.abc import AbstractChannel, AbstractIncomingMessage

from mock_interview_shared.schemas.messages import FeedbackRequest, FeedbackResult

from ..config import Settings
from ..services.ai import generate_feedback

logger = logging.getLogger(__name__)


async def handle(
    message: AbstractIncomingMessage, channel: AbstractChannel, settings: Settings
) -> None:
    async with message.process(requeue=False):
        req = FeedbackRequest.model_validate_json(message.body)

        score = await generate_feedback(req.question, req.transcript, settings.openai_api_key)

        result = FeedbackResult(
            interview_id=req.interview_id,
            feedback=score,
            app_id=settings.app_id,
        )
        await channel.default_exchange.publish(
            aio_pika.Message(body=result.model_dump_json(by_alias=True).encode()),
            routing_key="results_to_main_api",
        )

        logger.info("Processed feedback for interview %s", req.interview_id)
