
import functions_framework
from google.cloud import speech
from flask import escape

import requests


import os

NOT_FOUND = 'Specified environment variable is not set.'

feedback_app_id = os.environ.get("FEEDBACK_APP_ID", NOT_FOUND)
feedback_app_url = os.environ.get("FEEDBACK_APP_URL", NOT_FOUND)

main_api_url = os.environ.get("MAIN_API_URL", NOT_FOUND)
main_api_app_id = os.environ.get("MAIN_API_APP_ID", NOT_FOUND)


if NOT_FOUND in [feedback_app_id, feedback_app_url, main_api_url, main_api_app_id]:
    raise Exception("Environment variable not set")

        
def transcribe_audio(audio_uri) -> speech.RecognizeResponse:
    # Instantiates a client
    client = speech.SpeechClient()

    audio = speech.RecognitionAudio(uri=audio_uri)

    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=48000,
        language_code="en-US",
    )

    # Detects speech in the audio file
    response = client.recognize(config=config, audio=audio)

    print("response returned ->" ,response.total_billed_time)

    results = response.results

    print("results ->", len(results))

    return response.results[0].alternatives[0].transcript





def get_feedback(question, response):

    payload = {
        "question": question,
        "answer": response,
        "app_id": feedback_app_id
    }

    headers = {"Content-Type": "application/json"}

    r = requests.post(feedback_app_url,
                      json=payload, headers=headers)

    return r.text


def report_to_main_api(interview, response, feedback):
    payload = {
        "interview": interview,
        "answer": response,
        "feedback": feedback,
        "app_id": main_api_app_id
    }

    r = requests.post(main_api_url,
                      json=payload)


@functions_framework.http
def hello_http(request):

    request_json = request.get_json(silent=True)

    print(request_json)

    required_fields = ['interview', 'recording_path', 'question']

    for field in required_fields:
        if field not in request_json:
            return f"Missing field: {field}", 400

    question = request_json['question']
    recording_path = request_json['recording_path']
    interview = request_json['interview']

    # convert audio to text , get feedback , send feedback to feedback app

    transcript = transcribe_audio(recording_path)
    feedback = get_feedback(question, transcript)

    report_to_main_api(interview, transcript, feedback)

    return 'success', 200
