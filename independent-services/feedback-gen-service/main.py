
from flask import escape

import openai

openai.api_key = ''
trancript_app_id = ''

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
    """HTTP Cloud Function.
    Args:
        request (flask.Request): The request object.
        <https://flask.palletsprojects.com/en/1.1.x/api/#incoming-request-data>
    Returns:
        The response text, or any set of values that can be turned into a
        Response object using `make_response`
        <https://flask.palletsprojects.com/en/1.1.x/api/#flask.make_response>.
    """

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

