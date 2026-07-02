import json

from beanie import WriteRules
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError

from ..config import settings
from ..models.question import Question
from ..models.session import InterviewSession
from ..models.user import User
from ..services.auth import decode_token
from ..services.realtime_proxy import run_proxy_session

router = APIRouter(prefix="/interviews", tags=["realtime"])


async def _get_ws_user(token: str | None, websocket: WebSocket) -> User | None:
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None
    try:
        payload = decode_token(token, settings.jwt_secret, settings.jwt_algorithm)
        email: str | None = payload.get("email")
        if email is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None

    user = await User.find_one(User.email == email)
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None
    return user


@router.websocket("/live/{question_slug}")
async def live_interview(
    websocket: WebSocket,
    question_slug: str,
    token: str | None = None,
) -> None:
    await websocket.accept()

    user = await _get_ws_user(token, websocket)
    if user is None:
        return

    question = await Question.find_one(Question.slug == question_slug)
    if question is None:
        await websocket.send_text(json.dumps({"type": "error", "detail": "Question not found"}))
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    session = InterviewSession(
        user=user,  # type: ignore[arg-type]
        question=question,  # type: ignore[arg-type]
    )
    await session.insert(link_rule=WriteRules.DO_NOTHING)

    await websocket.send_text(
        json.dumps({"type": "session_created", "session_id": str(session.id)})
    )

    try:
        await run_proxy_session(
            websocket=websocket,
            session=session,
            question=question,
            openai_api_key=settings.openai_api_key,
            mq_connection=websocket.app.state.mq_connection,
        )
    except WebSocketDisconnect:
        pass
