import pytest
from mock_interview_shared.schemas.enums import MessageType
from mock_interview_shared.schemas.messages import (
    FeedbackRequest,
    FeedbackResult,
    FeedbackScore,
    TranscriptRequest,
    TranscriptResult,
)


def test_transcript_request_alias():
    obj = TranscriptRequest.model_validate(
        {"interview": "abc123", "recording_path": "/recordings/1.wav", "question": "Tell me about yourself"}
    )
    assert obj.interview_id == "abc123"


def test_transcript_request_dump_by_alias():
    obj = TranscriptRequest(interview_id="abc123", recording_path="/rec/1.wav", question="Q?")
    dumped = obj.model_dump(by_alias=True)
    assert "interview" in dumped
    assert dumped["interview"] == "abc123"


def test_feedback_request_alias():
    obj = FeedbackRequest.model_validate(
        {"interview": "xyz", "transcript": "I said...", "question": "Tell me about yourself"}
    )
    assert obj.interview_id == "xyz"


def test_feedback_request_dump_by_alias():
    obj = FeedbackRequest(interview_id="xyz", transcript="text", question="Q?")
    dumped = obj.model_dump(by_alias=True)
    assert "interview" in dumped
    assert dumped["interview"] == "xyz"


def test_transcript_result_type_serialises_as_string():
    obj = TranscriptResult(
        interview_id="id1",
        transcript="some text",
        app_id="app1",
        question="Q?",
    )
    dumped = obj.model_dump()
    assert dumped["type"] == "transcript"
    assert isinstance(dumped["type"], str)


def test_feedback_result_string_feedback_type_serialises():
    obj = FeedbackResult(
        interview_id="id2",
        feedback="Great job!",
        app_id="app1",
    )
    dumped = obj.model_dump()
    assert dumped["type"] == "feedback"
    assert isinstance(dumped["type"], str)


def test_feedback_result_with_feedback_score():
    score = FeedbackScore(
        overall_impression="Good",
        strengths=["clear communication"],
        areas_for_improvement=["pace"],
        suggestions=["slow down"],
        score=8,
    )
    obj = FeedbackResult(
        interview_id="id3",
        feedback=score,
        app_id="app2",
    )
    dumped = obj.model_dump()
    assert isinstance(dumped["feedback"], dict)
    assert dumped["feedback"]["score"] == 8
    assert dumped["feedback"]["overall_impression"] == "Good"


def test_message_type_values_are_strings():
    obj = TranscriptResult(
        interview_id="id4",
        transcript="txt",
        app_id="app",
        question="Q?",
    )
    dumped = obj.model_dump()
    assert dumped["type"] == MessageType.TRANSCRIPT.value
    assert isinstance(dumped["type"], str)


def test_transcript_request_round_trip():
    obj = TranscriptRequest(interview_id="r1", recording_path="/r.wav", question="Q?")
    dumped = obj.model_dump(by_alias=True)
    obj2 = TranscriptRequest.model_validate(dumped)
    assert obj2.interview_id == obj.interview_id
    assert obj2.recording_path == obj.recording_path


def test_feedback_request_round_trip():
    obj = FeedbackRequest(interview_id="r2", transcript="txt", question="Q?")
    dumped = obj.model_dump(by_alias=True)
    obj2 = FeedbackRequest.model_validate(dumped)
    assert obj2.interview_id == obj.interview_id


def test_transcript_result_round_trip():
    obj = TranscriptResult(interview_id="r3", transcript="txt", app_id="app", question="Q?")
    dumped = obj.model_dump(by_alias=True)
    obj2 = TranscriptResult.model_validate(dumped)
    assert obj2.interview_id == obj.interview_id
    assert obj2.transcript == obj.transcript


def test_feedback_result_string_round_trip():
    obj = FeedbackResult(interview_id="r4", feedback="text", app_id="app")
    dumped = obj.model_dump(by_alias=True)
    obj2 = FeedbackResult.model_validate(dumped)
    assert obj2.interview_id == obj.interview_id
    assert obj2.feedback == "text"


def test_feedback_result_score_round_trip():
    score = FeedbackScore(
        overall_impression="OK",
        strengths=["s1"],
        areas_for_improvement=["a1"],
        suggestions=["sug1"],
        score=7,
    )
    obj = FeedbackResult(interview_id="r5", feedback=score, app_id="app")
    dumped = obj.model_dump(by_alias=True)
    obj2 = FeedbackResult.model_validate(dumped)
    assert isinstance(obj2.feedback, FeedbackScore)
