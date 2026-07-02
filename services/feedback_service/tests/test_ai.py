import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mock_interview_shared.schemas.messages import FeedbackScore
from app.services.ai import generate_feedback

_MOCK_FEEDBACK = {
    "overall_impression": "Good answer with clear structure.",
    "strengths": ["Clear communication", "Used examples"],
    "areas_for_improvement": ["Could be more concise"],
    "suggestions": ["Practice the STAR method"],
    "score": 7,
}


@pytest.mark.asyncio
async def test_generate_feedback_returns_score() -> None:
    mock_message = MagicMock()
    mock_message.content = json.dumps(_MOCK_FEEDBACK)

    mock_choice = MagicMock()
    mock_choice.message = mock_message

    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch("app.services.ai.AsyncOpenAI", return_value=mock_client):
        result = await generate_feedback(
            "What is polymorphism?", "It means multiple forms...", "fake-key"
        )

    assert isinstance(result, FeedbackScore)
    assert result.score == 7
    assert result.overall_impression == "Good answer with clear structure."
    assert len(result.strengths) == 2
