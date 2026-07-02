from datetime import datetime, UTC
from beanie import Document, Link
from pydantic import Field
from mock_interview_shared.schemas.enums import InterviewStatus
from mock_interview_shared.schemas.messages import FeedbackScore
from .user import User
from .question import Question


class Interview(Document):
    user: Link[User]
    question: Link[Question]
    audio_url: str
    audio_transcript: str | None = None
    feedback: FeedbackScore | str | None = None
    status: InterviewStatus = InterviewStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "interviews"
