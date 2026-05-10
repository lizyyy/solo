from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./sms_audit.db"
    MAX_RETRY_COUNT: int = 3
    RETRY_INTERVAL_SECONDS: int = 60
    CHANNEL_TIMEOUT_SECONDS: int = 30
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
