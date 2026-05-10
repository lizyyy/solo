from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "农田遥感病斑核验系统"
    APP_VERSION: str = "1.0.0"
    
    DATABASE_URL: str = "sqlite:///./farm_verification.db"
    
    DEBUG: bool = True
    
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    COORDINATE_PRECISION: int = 6
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
