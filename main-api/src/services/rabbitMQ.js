const amqp = require('amqplib');

// Connection variables
let connection = null;
let channel = null;

// Queues
const QUEUES = {
  TRANSCRIPT: 'transcript_processing',
  FEEDBACK: 'feedback_processing',
  RESULTS: 'processing_results'
};

/**
 * Sets up the RabbitMQ connection and channels
 */
async function setupRabbitMQ() {
  try {
    // Connect to RabbitMQ server
    connection = await amqp.connect(process.env.RABBITMQ_URI || 'amqp://localhost:5672');
    
    // Create a channel
    channel = await connection.createChannel();
    
    // Assert queues to make sure they exist
    await channel.assertQueue(QUEUES.TRANSCRIPT, { durable: true });
    await channel.assertQueue(QUEUES.FEEDBACK, { durable: true });
    await channel.assertQueue(QUEUES.RESULTS, { durable: true });
    
    console.log('RabbitMQ queues set up successfully');
    
    // Set up consumer for processing results
    await setupResultsConsumer();
    
    return { connection, channel };
  } catch (error) {
    console.error('Error setting up RabbitMQ:', error);
    throw error;
  }
}

/**
 * Sets up a consumer for the results queue to process completed tasks
 */
async function setupResultsConsumer() {
  try {
    // Start consuming messages
    await channel.consume(QUEUES.RESULTS, async (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          console.log('Received result:', content);
          
          // Process the result based on the type
          switch (content.type) {
            case 'transcript':
              await processTranscriptResult(content);
              break;
            case 'feedback':
              await processFeedbackResult(content);
              break;
            default:
              console.warn('Unknown result type:', content.type);
          }
          
          // Acknowledge the message
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing result message:', error);
          // Acknowledge the message to prevent requeuing
          channel.ack(msg);
        }
      }
    });
    
    console.log('Results consumer set up successfully');
  } catch (error) {
    console.error('Error setting up results consumer:', error);
    throw error;
  }
}

/**
 * Processes a transcript result
 * @param {Object} result - The transcript result data
 */
async function processTranscriptResult(result) {
  const { interview, transcript } = result;
  
  // Update the interview record with the transcript
  const InterviewModel = require('../models/interview');
  await InterviewModel.findByIdAndUpdate(interview, {
    audio_transcript: transcript
  });
  
  // Send the transcript to the feedback service for processing
  await sendToFeedbackService(result);
}

/**
 * Processes a feedback result
 * @param {Object} result - The feedback result data
 */
async function processFeedbackResult(result) {
  const { interview, feedback } = result;
  
  // Update the interview record with the feedback
  const InterviewModel = require('../models/interview');
  await InterviewModel.findByIdAndUpdate(interview, {
    feedback: feedback
  });
}

/**
 * Sends a recording to the transcript service for processing
 * @param {Object} data - The data to send
 */
async function sendToTranscriptService(data) {
  try {
    channel.sendToQueue(
      QUEUES.TRANSCRIPT,
      Buffer.from(JSON.stringify(data)),
      { persistent: true }
    );
    console.log(`Sent recording to transcript service: ${data.interview}`);
    return true;
  } catch (error) {
    console.error('Error sending to transcript service:', error);
    throw error;
  }
}

/**
 * Sends a transcript to the feedback service for processing
 * @param {Object} data - The data to send
 */
async function sendToFeedbackService(data) {
  try {
    channel.sendToQueue(
      QUEUES.FEEDBACK,
      Buffer.from(JSON.stringify(data)),
      { persistent: true }
    );
    console.log(`Sent transcript to feedback service: ${data.interview}`);
    return true;
  } catch (error) {
    console.error('Error sending to feedback service:', error);
    throw error;
  }
}

/**
 * Gracefully closes the RabbitMQ connection
 */
async function closeRabbitMQ() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('RabbitMQ connection closed');
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error);
  }
}

// Listen for process termination signals to close RabbitMQ connection gracefully
process.on('SIGINT', async () => {
  await closeRabbitMQ();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeRabbitMQ();
  process.exit(0);
});

module.exports = {
  setupRabbitMQ,
  sendToTranscriptService,
  sendToFeedbackService,
  closeRabbitMQ,
  QUEUES
};