
from src.utils.logging_config import logger
from src.config import OPENAI_API_KEY , STORAGE_PATH
import os
from openai import OpenAI

def transcribe_audio(audio_filename):
    """
    Audio transcription service
    
    This would be replaced with your actual transcription service.
    For now, we'll return a dummy response.
    """
    logger.info(f"Transcribing audio: {audio_filename}")

    if not OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY not set. Cannot use Whisper for transcription.")
        return "Error: OpenAI API key not set. Cannot perform transcription."
    try:

        audio_path = os.path.join(STORAGE_PATH, audio_filename)
        
        if not os.path.exists(audio_path):
            logger.error(f"Audio file not found at path: {audio_path}")
            return "Error: Audio file not found"
        
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        with open(audio_path, 'rb') as audio_file:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
        
        transcript = response.text
        logger.info(f"Transcription complete: {transcript[:50]}...")
        return transcript
        
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")

        return "Error transcribing audio. Using placeholder: BLAH BLAH BLAH"