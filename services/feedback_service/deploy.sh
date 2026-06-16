gcloud functions deploy feedback-gen-service --gen2 --runtime=python311 --source=. --entry-point=hello_http --trigger-http --allow-unauthenticated --env-vars-file .env.yaml --max-instances=30
