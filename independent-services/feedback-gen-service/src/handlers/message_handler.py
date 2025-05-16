
import json
from src.utils.logging_config import logger
from src.services.ai_search import generate_feedback
from src.config import RESULTS_QUEUE, TRANSCRIPT_APP_ID
from src.services.rabbitmq import publish_message

def send_result_to_main_api(interview_id, feedback):
    """
    Send the result back to the main API
    """
    result = {
        'type': 'feedback',
        'interview': interview_id,
        'feedback': feedback,
        'app_id': TRANSCRIPT_APP_ID
    }
    
    return publish_message(RESULTS_QUEUE, result)

def process_message(ch, method, properties, body):
    """
    Process a message from the feedback queue
    """
    try:
        data = json.loads(body)
        logger.info(f"Processing message: {data}")
        
        interview_id = data.get('interview')
        transcript = data.get('transcript')
        question = data.get('question')
        
        if not all([interview_id, transcript, question]):
            logger.error("Missing required fields in message")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return
        
        feedback = generate_feedback(question, transcript)
        
        send_result_to_main_api(interview_id, feedback)
        
        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.info(f"Processed message for interview {interview_id}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        ch.basic_ack(delivery_tag=method.delivery_tag)