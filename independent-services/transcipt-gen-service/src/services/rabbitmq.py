import json
import time
import pika
from threading import Thread

from src.utils.logging_config import logger
from src.config import (
    RABBITMQ_URI, MAX_RETRIES, RETRY_DELAY,
    TRANSCRIPT_QUEUE, FEEDBACK_QUEUE, RESULTS_QUEUE
)


connection = None
channel = None



def connect_to_rabbitmq():
    """
    Connect to RabbitMQ server and create channel
    """
    global connection, channel


    for attempt in range(MAX_RETRIES):
        try:
            logger.info(
                f"Connecting to RabbitMQ (attempt {attempt+1}/{MAX_RETRIES})")
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
            if attempt < MAX_RETRIES - 1:
                logger.info(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                logger.error(
                    "Max retries reached. Could not connect to RabbitMQ.")
                return False

def start_consuming(queue_name, callback):
    """
    Start consuming messages from the queue
    """
    try:
        # Set prefetch count to 1 to ensure fair dispatch
        channel.basic_qos(prefetch_count=1)
        
        # Set up consumer
        channel.basic_consume(
            queue= queue_name,
            on_message_callback=callback
        )
        
        logger.info(f"Starting to consume messages from {queue_name}...")
        channel.start_consuming()
    except Exception as e:
        logger.error(f"Error in consumer: {e}")
        if connection and connection.is_open:
            connection.close()


def publish_message(queue_name, message, persistent=True):
    """
    Publish a message to the specified queue
    """
    try:
        if not channel:
            logger.error("No RabbitMQ channel available")
            return False
            
        channel.basic_publish(
            exchange='',
            routing_key=queue_name,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2 if persistent else 1,
            )
        )
        logger.info(f"Published message to {queue_name}")
        return True
    except Exception as e:
        logger.error(f"Error publishing message to {queue_name}: {e}")
        return False
    

def close_connection():
    """Close RabbitMQ connection"""
    if channel and channel.is_open:
        channel.stop_consuming()
    if connection and connection.is_open:
        connection.close()