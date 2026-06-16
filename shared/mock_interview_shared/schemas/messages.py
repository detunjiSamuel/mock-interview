from pydantic import BaseModel, ConfigDict, Field

from .enums import MessageType, Difficulty, Category


class TranscriptRequest(BaseModel):
    interview_id: str = Field(alias="interview")
    recording_path: str
    question: str
    difficulty: Difficulty | None = None
    category: Category | None = None
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class FeedbackRequest(BaseModel):
    interview_id: str = Field(alias="interview")
    transcript: str
    question: str
    difficulty: Difficulty | None = None
    category: Category | None = None
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class TranscriptResult(BaseModel):
    type: MessageType = MessageType.TRANSCRIPT
    interview_id: str = Field(alias="interview")
    transcript: str
    app_id: str
    question: str
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


class FeedbackScore(BaseModel):
    overall_impression: str
    strengths: list[str]
    areas_for_improvement: list[str]
    suggestions: list[str]
    score: int = Field(ge=1, le=10)


class FeedbackResult(BaseModel):
    type: MessageType = MessageType.FEEDBACK
    interview_id: str = Field(alias="interview")
    feedback: FeedbackScore | str
    app_id: str
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)
