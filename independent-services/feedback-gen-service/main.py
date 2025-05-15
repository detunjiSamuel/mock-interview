import os
import json
import logging
import time
import requests
import pika
from threading import Thread

from openai import OpenAI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

RABBITMQ_URI = os.getenv('RABBITMQ_URI', 'amqp://guest:guest@localhost:5672/')
OPEN_AI_API_KEY = os.getenv('OPENAI_API_KEY')
TRANSCRIPT_APP_ID = os.getenv('TRANSCRIPT_APP_ID', 'transcript_service')
FEEDBACK_QUEUE = 'feedback_processing'
RESULTS_QUEUE = 'processing_results'

NOT_FOUND = 'Specified environment variable is not set.'

if not OPEN_AI_API_KEY:
    logger.error("OpenAI API key not set! Feedback generation will not work.")
    raise Exception("Missing openAI key")


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
            logger.info(f"Connecting to RabbitMQ (attempt {attempt+1}/{max_retries})")
            connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URI))
            channel = connection.channel()
            
            # Declare queues
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
                logger.error("Max retries reached. Could not connect to RabbitMQ.")
                return False

def send_result_to_main_api(interview_id, feedback):
    """
    Send the result back to the main API
    """
    try:
        result = {
            'type': 'feedback',
            'interview': interview_id,
            'feedback': feedback,
            'app_id': TRANSCRIPT_APP_ID
        }
        
        channel.basic_publish(
            exchange='',
            routing_key=RESULTS_QUEUE,
            body=json.dumps(result),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            )
        )
        logger.info(f"Sent feedback to main API for interview {interview_id}")
        return True
    except Exception as e:
        logger.error(f"Error sending feedback to main API: {e}")
        return False


def generate_feedback(question , transcript):
    

    """
    Generate feedback based on the question and transcript
    """
    logger.info(f"Generating feedback for question: {question}")
    
    if not OPEN_AI_API_KEY:
        return "Error: OpenAI API key not set. Please configure the API key."
    
    try:
        # Background context for the AI assistant
        background = """
        Your task is to assist candidates in interview preparation.
        You will be given an interview question and the candidate's answer.
        Provide helpful feedback that would help the candidate improve.
        Your feedback should be constructive, specific, and actionable.
        
        Structure your feedback as follows:
        1. Overall impression
        2. Strengths (2-3 points)
        3. Areas for improvement (2-3 points)
        4. Specific suggestions
        5. Example of a stronger response
        """
        
        # Construct the prompt
        prompt = f"Question: {question}\n\nCandidate's Answer: {transcript}\n\nFeedback:"

        client = OpenAI( api_key =  OPEN_AI_API_KEY) #TODO: remove this , only use for dev
        
        # Generate feedback using OpenAI
        response = client.responses.create(
            model="gpt-4o",  # Update to a more recent model if needed
            instructions = background,
            input = prompt
        )
        
        feedback = response.output_text
        logger.info("Feedback generated successfully")
        return feedback
    
    except Exception as e:
        logger.error(f"Error generating feedback: {e}")
        return f"Error generating feedback: {str(e)}"


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
        
        # Generate feedback
        feedback = generate_feedback(question, transcript)
        
        # Send the result back to the main API
        send_result_to_main_api(interview_id, feedback)
        
        # Acknowledge the message
        ch.basic_ack(delivery_tag=method.delivery_tag)
        logger.info(f"Processed message for interview {interview_id}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        # Acknowledge the message to prevent requeuing
        ch.basic_ack(delivery_tag=method.delivery_tag)

def start_consuming():
    """
    Start consuming messages from the feedback queue
    """
    try:
        # Set prefetch count to 1 to ensure fair dispatch
        channel.basic_qos(prefetch_count=1)
        
        # Set up consumer
        channel.basic_consume(
            queue=FEEDBACK_QUEUE,
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
    logger.info("Starting feedback service...")
    
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

