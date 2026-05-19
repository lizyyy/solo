from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "换电运营工单系统"
    
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    DATABASE_URL: str = "sqlite:///./battery_swap.db"
    
    SENSITIVE_FIELDS: list = ["phone", "id_card", "address"]
    MASKING_PATTERN: str = "****"
    
    class Config:
        case_sensitive = True


@lru_cache()
def get_settings():
    return Settings()