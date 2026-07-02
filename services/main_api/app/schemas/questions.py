from pydantic import BaseModel
from mock_interview_shared.schemas.enums import Difficulty, Category


class QuestionResponse(BaseModel):
    id: str
    topic: str
    text: str
    helpful_tip: str | None = None
    difficulty: Difficulty
    category: Category
    slug: str
    video_url: str | None = None
    has_attempted: bool = False


class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    pages: int


class QuestionListResponse(BaseModel):
    questions: list[QuestionResponse]
    pagination: PaginationMeta
