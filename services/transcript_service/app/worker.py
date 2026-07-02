import asyncio
import functools
import logging

import uvicorn
from aio_pika.abc import AbstractIncomingMessage

from mock_interview_shared.mq.client import declare_queues, get_channel, get_connection

from .config import Settings
from .handlers.transcript import handle
from .health import app as health_app

logging.basicConfig(level=logging.INFO)


async def main() -> None:
    settings = Settings()

    connection = await get_connection(settings.rabbitmq_uri)
    channel = await get_channel(connection)
    queues = await declare_queues(channel)

    async def on_message(message: AbstractIncomingMessage) -> None:
        await handle(message, channel, settings)

    await queues["transcript_processing"].consume(on_message)

    server_config = uvicorn.Config(health_app, host="0.0.0.0", port=settings.health_port, log_level="warning")
    server = uvicorn.Server(server_config)

    await asyncio.gather(
        asyncio.get_event_loop().create_future(),  # keeps consumer alive
        server.serve(),
    )


if __name__ == "__main__":
    asyncio.run(main())
