
import requests


import os

import pika
from threading import Thread
import json
import logging
import time



logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


RABBITMQ_URI = os.getenv('RABBITMQ_URI', 'amqp://guest:guest@localhost:5672/')
MAIN_API_URL = os.getenv('MAIN_API_URL', 'http://localhost:8080')
MAIN_API_APP_ID = os.getenv('MAIN_API_APP_ID', 'transcript_service')
TRANSCRIPT_QUEUE = 'transcript_processing'
FEEDBACK_QUEUE = 'feedback_processing'
RESULTS_QUEUE = 'processing_results'


connection = None
channel = None


def connect_to_rabbitmq():
    """
    Connect to RabbitMQ server and create channel
    """
    global connection, channel

    # Parameters for connection retry
    max_retries = 5
    retry_delay = 5  # seconds

    for attempt in range(max_retries):
        try:
            logger.info(
                f"Connecting to RabbitMQ (attempt {attempt+1}/{max_retries})")
            connection = pika.BlockingConnection(
                pika.URLParameters(RABBITMQ_URI))
            channel = connection.channel()

            # Declare queues
            channel.queue_declare(queue=TRANSCRIPT_QUEUE, durable=True)
            channel.queue_declare(queue=FEEDBACK_QUEUE, durable=True)
            channel.queue_declare(queue=RESULTS_QUEUE, durable=True)

            logger.info("Successfully connected to RabbitMQ")
            return True
        except Exception as e:
            logger.error(f"Error connecting to RabbitMQ: {e}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logger.error(
                    "Max retries reached. Could not connect to RabbitMQ.")
                return False


def transcribe_audio(audio_uri):
    """
    Placeholder for audio transcription

    This would be replaced with your actual transcription service.
    For now, we'll return a dummy response.
    """
    logger.info(f"Transcribing audio: {audio_uri}")

    # This is a placeholder - replace with actual transcription logic
    # For example, using Google Cloud Speech-to-Text, Azure Cognitive Services, etc.

    # Simulate processing time
    time.sleep(2)

    # Return dummy transcript
    return "Money is the major motivation for me  , i don't really have any passion for the work you do here."



def send_to_feedback_service(interview_id, transcript, question):
    """
    Send the transcript to the feedback service via RabbitMQ
    """
    try:
        message = {
            'interview': interview_id,
            'transcript': transcript,
            'question': question
        }
        
        channel.basic_publish(
            exchange='',
            routing_key=FEEDBACK_QUEUE,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        logger.info(f"Sent transcript to feedback service for interview {interview_id}")
        return True
    except Exception as e:
        logger.error(f"Error sending to feedback service: {e}")
        return False
    


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
    

def send_result_to_main_api(interview_id, transcript , question):
    """
    Send the result back to the main API
    """
    try:
        result = {
            'type': 'transcript',
            'interview': interview_id,
            'transcript': transcript,
            'app_id': MAIN_API_APP_ID,
            'question': question

        }
        
        channel.basic_publish(
            exchange='',
            routing_key=RESULTS_QUEUE,
            body=json.dumps(result),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        logger.info(f"Sent result to main API for interview {interview_id}")        
        return True
    except Exception as e:
        logger.error(f"Error sending result to main API: {e}")
        fallback_send_result_to_main_api(result)
        return False


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
        
        # Transcribe the audio
        transcript = transcribe_audio(recording_path)
        
        # Send the result back to the main API
        send_result_to_main_api(interview_id, transcript , question)
        
        # Send to feedback service
        send_to_feedback_service(interview_id, transcript, question)
        
        # Acknowledge the message
        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.info(f"Processed message for interview {interview_id}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        # Acknowledge the message to prevent requeuing
        # In production, you might want to implement a retry mechanism
        ch.basic_ack(delivery_tag=method.delivery_tag)

def start_consuming():
    """
    Start consuming messages from the transcript queue
    """
    try:
        # Set prefetch count to 1 to ensure fair dispatch
        channel.basic_qos(prefetch_count=1)
        
        # Set up consumer
        channel.basic_consume(
            queue=TRANSCRIPT_QUEUE,
            on_message_callback=process_message
        )
        
        logger.info("Starting to consume messages...")
        channel.start_consuming()
    except Exception as e:
        logger.error(f"Error in consumer: {e}")
        if connection and connection.is_open:
            connection.close()

def main():
    """
    Main function to start the service
    """
    logger.info("Starting transcript service...")
    
    # Connect to RabbitMQ
    if not connect_to_rabbitmq():
        logger.error("Failed to connect to RabbitMQ. Exiting.")
        return
    
    # Start consuming in a separate thread
    consumer_thread = Thread(target=start_consuming)
    consumer_thread.daemon = True
    consumer_thread.start()
    
    try:
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Received interrupt. Shutting down...")
        if channel and channel.is_open:
            channel.stop_consuming()
        if connection and connection.is_open:
            connection.close()

if __name__ == "__main__":
    main()