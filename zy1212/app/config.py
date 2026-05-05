from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "LoadTest Review API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    DATABASE_URL: str = "sqlite:///./loadtest_review.db"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
