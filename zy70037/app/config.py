from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "冷柜维修派单系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    DATABASE_URL: str = "sqlite:///./freezer_repair.db"
    
    TEMPERATURE_THRESHOLD_HIGH: float = 10.0
    TEMPERATURE_THRESHOLD_LOW: float = -25.0
    
    DISPATCH_TIMEOUT_MINUTES: int = 30
    FIRST_ESCALATION_MINUTES: int = 120
    SECOND_ESCALATION_MINUTES: int = 240
    
    class Config:
        env_file = ".env"

settings = Settings()
