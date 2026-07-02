from openai import AsyncOpenAI

from mock_interview_shared.schemas.messages import FeedbackScore

_SYSTEM_PROMPT = """You are a professional interview coach. Evaluate the candidate's answer and return JSON only.

Return a JSON object with exactly these fields:
{
  "overall_impression": "<string>",
  "strengths": ["<string>", ...],
  "areas_for_improvement": ["<string>", ...],
  "suggestions": ["<string>", ...],
  "score": <integer 1-10>
}"""


async def generate_feedback(question: str, transcript: str, api_key: str) -> FeedbackScore:
    client = AsyncOpenAI(api_key=api_key)
    user_prompt = f"Question: {question}\n\nCandidate's Answer: {transcript}"
    response = await client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )
    content = response.choices[0].message.content or "{}"
    return FeedbackScore.model_validate_json(content)
