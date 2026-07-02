from openai import AsyncOpenAI


async def transcribe(audio_path: str, api_key: str) -> str:
    client = AsyncOpenAI(api_key=api_key)
    with open(audio_path, "rb") as f:
        response = await client.audio.transcriptions.create(model="whisper-1", file=f)
    return response.text
