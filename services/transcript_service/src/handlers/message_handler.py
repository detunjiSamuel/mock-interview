import json
from src.utils.logging_config import logger
from src.services.rabbitmq import publish_message
from src.services.audio import transcribe_audio
from src.config import FEEDBACK_QUEUE, RESULTS_QUEUE, MAIN_API_APP_ID , MAIN_API_URL
import requests


def process_message(ch, method, properties, body):
    """
    Process a message from the transcript queue
    """
    try:
        data = json.loads(body)
        logger.info(f"Processing message: {data}")
        
        interview_id = data.get('interview')
        recording_path = data.get('recording_path')
        question = data.get('question')
        
        if not all([interview_id, recording_path, question]):
            logger.error("Missing required fields in message")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return
        

        transcript = transcribe_audio(recording_path)
        
        send_result_to_main_api(interview_id, transcript, question) #main api stores the transcipt data here
        
        send_to_feedback_service(interview_id, transcript, question) #forward for further process
        
        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.info(f"Processed message for interview {interview_id}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")

        ch.basic_ack(delivery_tag=method.delivery_tag)

def send_to_feedback_service(interview_id, transcript, question):
    """
    Send the transcript to the feedback service via RabbitMQ
    """
    message = {
        'interview': interview_id,
        'transcript': transcript,
        'question': question
    }
    return publish_message(FEEDBACK_QUEUE, message)


def send_result_to_main_api(interview_id, transcript, question):
    """
    Send the result back to the main API
    """
    result = {
        'type': 'transcript',
        'interview': interview_id,
        'transcript': transcript,
        'app_id': MAIN_API_APP_ID,
        'question': question
    }
    
    success = publish_message(RESULTS_QUEUE, result)
    if not success:
        fallback_send_result_to_main_api(result)
    return success

def fallback_send_result_to_main_api(result):
     """
     Fallback - use regular API call instead of use queues
     """
     try:
         response = requests.post(
         f"{MAIN_API_URL}/api/submit-feedback",
         json=result,
         headers={"Content-Type": "application/json"} #TODO: add the app ID in headers
     )
         if response.status_code == 200:
             logger.info(f"Successfully sent result directly to main API")
         else:
             logger.warning(f"Received non-200 response from main API: {response.status_code}")
     except Exception as api_error:
         logger.error(f"Error sending result directly to main API: {api_error}")