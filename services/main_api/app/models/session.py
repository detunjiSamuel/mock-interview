from datetime import datetime, UTC

from beanie import Document, Link
from pydantic import BaseModel, Field

from mock_interview_shared.schemas.enums import SessionStatus

from .question import Question
from .user import User


class SessionMessage(BaseModel):
    role: str
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class InterviewSession(Document):
    user: Link[User]
    question: Link[Question]
    messages: list[SessionMessage] = Field(default_factory=list)
    status: SessionStatus = SessionStatus.ACTIVE
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "interview_sessions"
