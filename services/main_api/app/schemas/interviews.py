from typing import Annotated, Union
from pydantic import BaseModel, Field
from mock_interview_shared.schemas.messages import TranscriptResult, FeedbackResult
from mock_interview_shared.schemas.enums import InterviewStatus
from mock_interview_shared.schemas.messages import FeedbackScore


class SubmitRecordingResponse(BaseModel):
    message: str
    interview: str


class InterviewFeedback(BaseModel):
    id: str
    status: InterviewStatus
    audio_url: str
    audio_transcript: str | None = None
    feedback: FeedbackScore | str | None = None
    question: dict | None = None


class FeedbackResponse(BaseModel):
    interview: InterviewFeedback


# Discriminated union for internal result — matches on the `type` field
InternalResultRequest = Annotated[
    Union[TranscriptResult, FeedbackResult],
    Field(discriminator="type"),
]
