import asyncio
import json
from typing import AsyncGenerator

from beanie import WriteRules
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse

from ..config import settings
from ..dependencies import get_current_user, get_mq_channel, manager
from ..models.interview import Interview
from ..models.question import Question
from ..models.user import User
from ..schemas.interviews import FeedbackResponse, InterviewFeedback, SubmitRecordingResponse
from ..services.files import LocalFileStorage
from ..services.mq_publisher import publish_transcript_request

router = APIRouter(prefix="/interviews", tags=["interviews"])

_file_storage = LocalFileStorage(settings.file_storage_path)


@router.post("/submit-recording", response_model=SubmitRecordingResponse)
async def submit_recording(
    request: Request,
    question_id: str = Form(...),
    audio_response: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    channel=Depends(get_mq_channel),
) -> SubmitRecordingResponse:
    question = await Question.find_one(Question.slug == question_id.lower())
    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    filename = await _file_storage.save(audio_response)

    interview = Interview(
        user=current_user,  # type: ignore[arg-type]
        question=question,  # type: ignore[arg-type]
        audio_url=filename,
    )
    await interview.insert(link_rule=WriteRules.DO_NOTHING)

    await publish_transcript_request(
        channel=channel,
        interview_id=str(interview.id),
        recording_path=filename,
        question_text=question.text,
        difficulty=question.difficulty,
        category=question.category,
    )

    return SubmitRecordingResponse(message="success", interview=str(interview.id))


@router.get("/{id}/feedback", response_model=FeedbackResponse)
async def get_interview_feedback(
    id: str,
    current_user: User = Depends(get_current_user),
) -> FeedbackResponse:
    if not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid interview id",
        )

    interview = await Interview.get(ObjectId(id), fetch_links=True)
    if interview is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    # Ensure user owns this interview
    interview_user_id = (
        str(interview.user.id) if hasattr(interview.user, "id") else str(interview.user)
    )
    if interview_user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Interview does not belong to current user",
        )

    question_data = None
    if hasattr(interview.question, "topic"):
        q = interview.question
        question_data = {
            "id": str(q.id),
            "topic": q.topic,
            "text": q.text,
            "slug": q.slug,
            "difficulty": q.difficulty,
            "category": q.category,
        }

    return FeedbackResponse(
        interview=InterviewFeedback(
            id=str(interview.id),
            status=interview.status,
            audio_url=interview.audio_url,
            audio_transcript=interview.audio_transcript,
            feedback=interview.feedback,
            question=question_data,
        )
    )


async def _sse_event_generator(
    interview_id: str,
    queue: asyncio.Queue,
    request: Request,
) -> AsyncGenerator[str, None]:
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                data = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"data: {json.dumps(data)}\n\n"
            except asyncio.TimeoutError:
                # Send keep-alive comment
                yield ": keep-alive\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        manager.disconnect(interview_id)


@router.get("/{id}/stream")
async def stream_interview(
    id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    if not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid interview id",
        )

    # Ownership check — prevent users from tapping other users' SSE streams
    interview = await Interview.get(ObjectId(id))
    if interview is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )
    interview_user_id = (
        str(interview.user.id) if hasattr(interview.user, "id") else str(interview.user)
    )
    if interview_user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Interview does not belong to current user",
        )

    queue: asyncio.Queue = asyncio.Queue()
    manager.connect(id, queue)

    return StreamingResponse(
        _sse_event_generator(id, queue, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
