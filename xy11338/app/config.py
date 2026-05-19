from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "家电售后仓管理系统"
    
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    DATABASE_URL: str = "sqlite:///./warranty_warehouse.db"
    
    SENSITIVE_FIELDS: list = ["phone", "id_card", "address", "customer_name"]
    MASK_CHAR: str = "*"
    
    class Config:
        case_sensitive = True


settings = Settings()
