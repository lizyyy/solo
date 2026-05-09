from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "排污许可超标预警系统"
    API_VERSION: str = "v1"
    
    DATABASE_URL: str = "sqlite:///./pollution_warning.db"
    
    SECRET_KEY: str = "secret-key-please-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    MAX_CONCURRENT_IMPORTS: int = 3
    IMPORT_LOCK_TIMEOUT: int = 300

    class Config:
        env_file = ".env"


settings = Settings()
