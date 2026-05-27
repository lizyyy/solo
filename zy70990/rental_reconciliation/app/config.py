import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "Rental Reconciliation Service"
    APP_VERSION: str = "1.0.0"
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./rental_reconciliation.db")
    
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    EXPORT_DIR: str = os.getenv("EXPORT_DIR", "./exports")
    
    ELECTRICITY_TIER_THRESHOLD_1: float = 0.5
    ELECTRICITY_TIER_RATE_1: float = 0.5
    ELECTRICITY_TIER_THRESHOLD_2: float = 1.0
    ELECTRICITY_TIER_RATE_2: float = 0.8
    ELECTRICITY_TIER_RATE_3: float = 1.2
    
    WATER_RATE: float = 5.0
    
    DEFAULT_DEPOSIT_AMOUNT: float = 2000.0
    
    class Config:
        env_file = ".env"


settings = Settings()