from fastapi import APIRouter, Header, HTTPException, status
from bson import ObjectId

from mock_interview_shared.schemas.enums import InterviewStatus, MessageType
from mock_interview_shared.schemas.messages import FeedbackResult, TranscriptResult

from ..config import settings
from ..dependencies import manager
from ..models.interview import Interview
from ..schemas.interviews import InternalResultRequest

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/submit-result", status_code=status.HTTP_200_OK)
async def submit_result(
    body: InternalResultRequest,
    x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
) -> dict:
    if x_internal_secret != settings.internal_api_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    if not ObjectId.is_valid(body.interview_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid interview id",
        )

    interview = await Interview.get(ObjectId(body.interview_id))
    if interview is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    if body.type == MessageType.TRANSCRIPT:
        assert isinstance(body, TranscriptResult)
        interview.audio_transcript = body.transcript
        interview.status = InterviewStatus.PROCESSING
        await interview.save()

    elif body.type == MessageType.FEEDBACK:
        assert isinstance(body, FeedbackResult)
        interview.feedback = body.feedback
        interview.status = InterviewStatus.DONE
        await interview.save()

        payload = {
            "type": "feedback",
            "interview_id": body.interview_id,
            "feedback": (
                body.feedback.model_dump()
                if hasattr(body.feedback, "model_dump")
                else body.feedback
            ),
        }
        await manager.send(body.interview_id, payload)

    return {"message": "acknowledged"}
