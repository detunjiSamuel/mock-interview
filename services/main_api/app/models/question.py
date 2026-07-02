from beanie import Document, Indexed
from mock_interview_shared.schemas.enums import Difficulty, Category


class Question(Document):
    topic: str
    text: str
    helpful_tip: str | None = None
    difficulty: Difficulty
    category: Category
    slug: Indexed(str, unique=True)  # type: ignore[valid-type]
    video_url: str | None = None

    class Settings:
        name = "questions"
