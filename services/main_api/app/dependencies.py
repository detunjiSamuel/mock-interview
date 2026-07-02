import asyncio
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from .config import settings
from .models.user import User
from .services.auth import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
_optional_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token, settings.jwt_secret, settings.jwt_algorithm)
        email: str | None = payload.get("email")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await User.find_one(User.email == email)
    if user is None:
        raise credentials_exception
    return user


async def get_optional_user(token: Optional[str] = Depends(_optional_oauth2)) -> Optional[User]:
    if token is None:
        return None
    try:
        payload = decode_token(token, settings.jwt_secret, settings.jwt_algorithm)
        email: str | None = payload.get("email")
        if email is None:
            return None
        return await User.find_one(User.email == email)
    except JWTError:
        return None


async def get_mq_channel(request: Request):
    connection = request.app.state.mq_connection
    channel = await connection.channel()
    try:
        yield channel
    finally:
        await channel.close()


class ConnectionManager:
    """SSE connection manager — one asyncio.Queue per interview_id."""

    def __init__(self) -> None:
        self._queues: dict[str, asyncio.Queue] = {}

    def connect(self, interview_id: str, queue: asyncio.Queue) -> None:
        self._queues[interview_id] = queue

    def disconnect(self, interview_id: str) -> None:
        self._queues.pop(interview_id, None)

    async def send(self, interview_id: str, data: dict) -> None:
        queue = self._queues.get(interview_id)
        if queue is not None:
            await queue.put(data)


manager = ConnectionManager()
