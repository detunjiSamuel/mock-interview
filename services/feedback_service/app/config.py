from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str
    rabbitmq_uri: str
    app_id: str = "feedback_service"
    health_port: int = 8002
