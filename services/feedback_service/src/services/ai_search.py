from src.utils.logging_config import logger
from src.config import OPENAI_API_KEY
from openai import OpenAI



def generate_feedback(question , transcript):
    

    """
    Generate feedback based on the question and transcript
    """
    logger.info(f"Generating feedback for question: {question}")
    
    if not OPENAI_API_KEY:
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

        client = OpenAI( api_key =  OPENAI_API_KEY) #TODO: remove this , only use for dev
        
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
