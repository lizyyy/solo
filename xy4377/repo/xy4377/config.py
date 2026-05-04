from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./festival_power.db"
    APP_NAME: str = "Festival Power Management API"
    DEBUG: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
