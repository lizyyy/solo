from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "印刷车间品控系统"
    
    DATABASE_URL: str = "sqlite:///./print_quality_control.db"
    
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    SENSITIVE_FIELDS: list = ["operator_id", "customer_info", "cost_details"]
    MASK_CHAR: str = "*"
    
    class Config:
        case_sensitive = True


@lru_cache()
def get_settings():
    return Settings()
