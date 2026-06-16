import aio_pika
from aio_pika.abc import AbstractRobustConnection, AbstractChannel, AbstractQueue

# transcript_processing — main API → transcript service: audio file path + question, triggers Whisper
# feedback_processing   — transcript service → feedback service: transcript + question, triggers GPT-4o
# results_to_main_api  — both workers → main API: delivers transcript or feedback result back
QUEUE_NAMES = ["transcript_processing", "feedback_processing", "results_to_main_api"]


async def get_connection(url: str) -> AbstractRobustConnection:
    """Create a robust RabbitMQ connection (auto-reconnects)."""
    return await aio_pika.connect_robust(url)


async def get_channel(connection: AbstractRobustConnection) -> AbstractChannel:
    return await connection.channel()


async def declare_queues(channel: AbstractChannel) -> dict[str, AbstractQueue]:
    """Declare all service queues as durable. Sets prefetch_count=1 for fair consumer dispatch."""
    await channel.set_qos(prefetch_count=1)
    queues: dict[str, AbstractQueue] = {}
    for name in QUEUE_NAMES:
        queues[name] = await channel.declare_queue(name, durable=True)
    return queues
