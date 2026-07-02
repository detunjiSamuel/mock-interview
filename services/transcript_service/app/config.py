from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str
    rabbitmq_uri: str
    storage_path: str = "/app/storage"
    app_id: str = "transcript_service"
    health_port: int = 8001
