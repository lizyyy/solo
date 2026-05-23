from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./grievance.db"
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "机场地服申诉预审系统"
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
