import asyncio
import base64
import json
import logging

import aio_pika
from aio_pika.abc import AbstractRobustConnection
from fastapi import WebSocket, WebSocketDisconnect
from websockets.asyncio.client import connect as ws_connect

from mock_interview_shared.schemas.enums import SessionStatus
from mock_interview_shared.schemas.messages import FeedbackRequest

from ..models.interview import Interview
from ..models.question import Question
from ..models.session import InterviewSession, SessionMessage

logger = logging.getLogger(__name__)

_OPENAI_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"

_SYSTEM_PROMPT = (
    "You are a professional technical interviewer conducting a mock interview.\n"
    "Your role: Ask the candidate the question provided, listen actively, ask one clarifying "
    "follow-up if their answer is incomplete, then conclude the session professionally.\n"
    "Keep responses concise and professional.\n"
    "The interview question is: {question_text}\n"
    'When you are ready to end the session, say "Thank you, that concludes our interview."'
)


async def _publish_feedback(
    mq_connection: AbstractRobustConnection,
    interview_id: str,
    question: Question,
    transcript: str,
) -> None:
    channel = await mq_connection.channel()
    try:
        request = FeedbackRequest(
            interview=interview_id,
            transcript=transcript,
            question=question.text,
            difficulty=question.difficulty,
            category=question.category,
        )
        body = request.model_dump_json(by_alias=True).encode()
        msg = aio_pika.Message(
            body=body,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            content_type="application/json",
        )
        await channel.default_exchange.publish(msg, routing_key="feedback_processing")
    finally:
        await channel.close()


async def run_proxy_session(
    websocket: WebSocket,
    session: InterviewSession,
    interview: Interview,
    question: Question,
    openai_api_key: str,
    mq_connection: AbstractRobustConnection,
) -> None:
    accumulated: list[SessionMessage] = []
    headers = {
        "Authorization": f"Bearer {openai_api_key}",
        "OpenAI-Beta": "realtime=v1",
    }

    try:
        async with ws_connect(_OPENAI_URL, additional_headers=headers) as openai_ws:
            session_update = {
                "type": "session.update",
                "session": {
                    "modalities": ["audio", "text"],
                    "instructions": _SYSTEM_PROMPT.format(question_text=question.text),
                    "voice": "alloy",
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "input_audio_transcription": {"model": "whisper-1"},
                    "turn_detection": {"type": "server_vad"},
                },
            }
            await openai_ws.send(json.dumps(session_update))

            async def browser_to_openai() -> None:
                try:
                    while True:
                        raw = await websocket.receive()
                        if raw["type"] == "websocket.disconnect":
                            return
                        if raw.get("bytes"):
                            # Binary audio chunk from browser: convert to base64 and
                            # wrap in the format OpenAI Realtime API expects.
                            audio_b64 = base64.b64encode(raw["bytes"]).decode()
                            await openai_ws.send(
                                json.dumps(
                                    {
                                        "type": "input_audio_buffer.append",
                                        "audio": audio_b64,
                                    }
                                )
                            )
                        elif raw.get("text"):
                            text = raw["text"]
                            try:
                                msg = json.loads(text)
                            except json.JSONDecodeError:
                                await openai_ws.send(text)
                                continue
                            if msg.get("type") == "end_session":
                                return
                            await openai_ws.send(text)
                except WebSocketDisconnect:
                    return
                except Exception as exc:
                    logger.warning("browser_to_openai error: %s", exc)

            async def openai_to_browser() -> None:
                try:
                    async for raw in openai_ws:
                        text_data = raw if isinstance(raw, str) else raw.decode()
                        try:
                            msg = json.loads(text_data)
                        except json.JSONDecodeError:
                            await websocket.send_text(text_data)
                            continue
                        if msg.get("type") == "conversation.item.created":
                            item = msg.get("item", {})
                            role = item.get("role", "")
                            for part in item.get("content", []):
                                content = part.get("text") or part.get("transcript") or ""
                                if content and role:
                                    accumulated.append(SessionMessage(role=role, content=content))
                        await websocket.send_text(text_data)
                except WebSocketDisconnect:
                    return
                except Exception as exc:
                    logger.warning("openai_to_browser error: %s", exc)

            task_b2o = asyncio.create_task(browser_to_openai())
            task_o2b = asyncio.create_task(openai_to_browser())

            _done, pending = await asyncio.wait(
                [task_b2o, task_o2b],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

    except Exception as exc:
        logger.error("OpenAI realtime connection failed: %s", exc)
        session.status = SessionStatus.FAILED
        await session.save()
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "detail": "OpenAI connection failed"})
            )
        except Exception:
            pass
        return

    session.status = SessionStatus.COMPLETED
    session.messages = accumulated
    await session.save()

    if accumulated:
        transcript = "\n".join(f"{m.role}: {m.content}" for m in accumulated)
        try:
            await _publish_feedback(mq_connection, str(interview.id), question, transcript)
        except Exception as exc:
            logger.error("Failed to publish feedback request: %s", exc)
