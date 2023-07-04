
from google.cloud import speech


test_uri = "gs://cloud-samples-data/speech/brooklyn_bridge.raw"



def transcribe_audio(audio_uri) -> speech.RecognizeResponse:
    # Instantiates a client
    client = speech.SpeechClient()

    audio = speech.RecognitionAudio(uri=audio_uri)

    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="en-US",
    )

    # Detects speech in the audio file
    response = client.recognize(config=config, audio=audio)


    return response.results[0].alternatives[0].transcript

    for result in response.results:
        print(f"Transcript: {result.alternatives[0].transcript}")


# print(transcribe_audio(test_uri)


       