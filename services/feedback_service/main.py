import time
import signal
from threading import Thread


from src.utils.logging_config import logger
from src.services.rabbitmq import (
    connect_to_rabbitmq, 
    start_consuming, 
    close_connection
)


from src.handlers.message_handler import process_message
from src.config import FEEDBACK_QUEUE



def main():
    """
    Main function to start the service
    """
    logger.info("Starting feedback service...")
    
    if not connect_to_rabbitmq():
        logger.error("Failed to connect to RabbitMQ. Exiting.")
        return
    

    consumer_thread = Thread(target=start_consuming , args=(FEEDBACK_QUEUE, process_message))
    consumer_thread.daemon = True
    consumer_thread.start()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    
    try:

        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Received interrupt. Shutting down...")
        close_connection()

def signal_handler(sig, frame):
    """Handle termination signals"""
    logger.info(f"Received signal {sig}. Shutting down...")
    close_connection()
    exit(0)

if __name__ == "__main__":
    main()

