
from flask import escape

import os

import openai

NOT_FOUND = 'Specified environment variable is not set.'

openai_api_key = os.environ.get("OPEN_AI_API_KEY", NOT_FOUND)
trancript_app_id = os.environ.get("TRANSCRIPT_APP_ID",NOT_FOUND)

if NOT_FOUND in [openai_api_key , trancript_app_id]:
    raise Exception("Environment variable not set")

openai.api_key = openai_api_key
    

background = """

You main task is to assist in candidates in interview preperation.
You will not stray from this task.
You would be given a question and candiate's answer.
You are to respond with helpful feedback based on candiates answer
that would help the candidate improve.

"""


def get_feedback(question , response):
    
    prompt = background + "Question: " + question + "\ncandidate's Answer: " + response + "\nFeedback:"

    completion = openai.Completion.create(model="text-davinci-002", prompt=prompt)

    return completion.choices[0].text



test_question = "Why do you want to work here?"

test_answer = "I am passionate about technlogy and I want to work for a company that is at the forefront of the industry."


# print(get_feedback(test_question , test_answer))
    

import functions_framework

@functions_framework.http
def hello_http(request):
    content_type = request.headers["content-type"]

    if not content_type == "application/json":
        return "Only application/json requests are supported", 400
    

    request_json = request.get_json(silent=True)

    if request.method is not 'POST':
        return "Only POST requests are accepted", 405
    
    required_fields = ['question' , 'answer' , 'app_id']

    for field in required_fields:
        if field not in request_json:
            return f"Missing field: {field}", 400

    if request_json['app_id'] != trancript_app_id:
        return "Invalid app id", 400
    

    question = request_json['question']
    answer = request_json['answer']

    feedback = get_feedback(question , answer)

    return feedback , 200

