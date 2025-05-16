import os

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

RABBITMQ_URI = os.getenv('RABBITMQ_URI', 'amqp://guest:guest@localhost:5672/')
TRANSCRIPT_APP_ID = os.getenv('TRANSCRIPT_APP_ID', 'transcript_service')



RABBITMQ_URI = os.getenv('RABBITMQ_URI', 'amqp://guest:guest@localhost:5672/')
MAIN_API_URL = os.getenv('MAIN_API_URL', 'http://localhost:8080')
MAIN_API_APP_ID = os.getenv('MAIN_API_APP_ID', 'transcript_service')


TRANSCRIPT_QUEUE = 'transcript_processing'
FEEDBACK_QUEUE = 'feedback_processing'
RESULTS_QUEUE = 'processing_results'


MAX_RETRIES = 5
RETRY_DELAY = 5  # seconds