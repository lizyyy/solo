from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "电池包放行管家"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    DEFAULT_MAX_STORAGE_DAYS: int = 30
    DEFAULT_MAX_CELL_VOLTAGE_DIFF: float = 0.05
    DEFAULT_LOW_VOLTAGE_THRESHOLD: float = 3.2
    DEFAULT_MAX_CYCLE_JUMP: int = 5
    DEFAULT_MIN_TEMPERATURE: float = -10.0
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
