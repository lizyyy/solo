from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./pharmacy_inventory.db"
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    TEMPERATURE_MIN: float = 2.0
    TEMPERATURE_MAX: float = 8.0
    
    SENSITIVE_FIELDS: list = [
        "id_card",
        "phone",
        "address",
        "email"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
