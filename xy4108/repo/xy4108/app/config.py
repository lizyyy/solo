from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "过敏原配餐审校站"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    DATABASE_URL: str = "sqlite:///./allergen_checker.db"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
