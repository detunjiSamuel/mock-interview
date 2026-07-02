from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.whisper import transcribe


@pytest.mark.asyncio
async def test_transcribe_returns_text() -> None:
    mock_response = MagicMock()
    mock_response.text = "Hello world transcript"

    mock_client = AsyncMock()
    mock_client.audio.transcriptions.create = AsyncMock(return_value=mock_response)

    with patch("app.services.whisper.AsyncOpenAI", return_value=mock_client):
        with patch("builtins.open", MagicMock()):
            result = await transcribe("/fake/path/audio.mp3", "fake-key")

    assert result == "Hello world transcript"
    mock_client.audio.transcriptions.create.assert_called_once()
