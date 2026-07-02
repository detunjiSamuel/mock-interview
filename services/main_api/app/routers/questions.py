import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..dependencies import get_optional_user
from ..models.interview import Interview
from ..models.question import Question
from ..models.user import User
from ..schemas.questions import PaginationMeta, QuestionListResponse, QuestionResponse

router = APIRouter(prefix="/questions", tags=["questions"])


def _question_to_response(q: Question, has_attempted: bool = False) -> QuestionResponse:
    return QuestionResponse(
        id=str(q.id),
        topic=q.topic,
        text=q.text,
        helpful_tip=q.helpful_tip,
        difficulty=q.difficulty,
        category=q.category,
        slug=q.slug,
        video_url=q.video_url,
        has_attempted=has_attempted,
    )


@router.get("", response_model=QuestionListResponse)
async def list_questions(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    category: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_user),
) -> QuestionListResponse:
    # Build pymongo filter dict
    filter_dict: dict = {}
    if category:
        filter_dict["category"] = category
    if difficulty:
        filter_dict["difficulty"] = difficulty
    if search:
        filter_dict["$or"] = [
            {"topic": {"$regex": search, "$options": "i"}},
            {"text": {"$regex": search, "$options": "i"}},
        ]

    skip = (page - 1) * limit

    questions = await Question.find(filter_dict).sort("topic").skip(skip).limit(limit).to_list()
    total = await Question.find(filter_dict).count()

    # Build has_attempted map if user is logged in
    attempted_ids: set[str] = set()
    if current_user and questions:
        q_ids = [q.id for q in questions]
        interviews = await Interview.find(
            {"question.$id": {"$in": q_ids}, "user.$id": current_user.id},
            fetch_links=True,
        ).to_list()
        for interview in interviews:
            if isinstance(interview.question, Question):
                attempted_ids.add(str(interview.question.id))

    responses = [_question_to_response(q, str(q.id) in attempted_ids) for q in questions]

    return QuestionListResponse(
        questions=responses,
        pagination=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            pages=math.ceil(total / limit) if total else 0,
        ),
    )


@router.get("/{slug}", response_model=QuestionResponse)
async def get_question(slug: str) -> QuestionResponse:
    question = await Question.find_one(Question.slug == slug.lower())
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )
    return _question_to_response(question)
