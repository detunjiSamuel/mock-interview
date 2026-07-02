from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://root:example@localhost:27017/interview?authSource=admin"
    rabbitmq_uri: str = "amqp://guest:guest@localhost:5672"
    jwt_secret: str  # no default — must be set via env or .env file
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 2
    file_storage_path: str = "./storage"
    internal_api_secret: str  # no default — must be set via env or .env file
    port: int = 8000

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
