from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://drakeai:Drake_AI_Kalpra123@127.0.0.1:5432/drakeai"
    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str = "change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "drakeai_minio"
    MINIO_SECRET_KEY: str = "drakeai_minio_secret"
    MINIO_BUCKET: str = "drakeai-files"
    MINIO_USE_SSL: bool = False

    ANTHROPIC_API_KEY: str = ""
    VLLM_API_KEY: str = "EMPTY"
    VLLM_CHAT_BASE_URL: str = "http://localhost:8000/v1"
    VLLM_EMBEDDING_BASE_URL: str = "http://localhost:8001/v1"
    VLLM_OCR_BASE_URL: str = "http://localhost:8700/v1"
    LLM_MODEL: str = "qwen2.5-7b-instruct"
    VLLM_OCR_MODEL: str = "qwen2.5-vl-7b"
    VLLM_TIMEOUT_SECONDS: float = 120.0

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
    ]

    APP_ENV: str = "development"
    DEBUG: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
