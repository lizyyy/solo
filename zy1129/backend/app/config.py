from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./insurance.db"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    DEBUG: bool = True
    
    class Config:
        env_file = ".env"


settings = Settings()
