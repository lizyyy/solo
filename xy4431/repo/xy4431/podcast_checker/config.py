from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    DB_PATH: Path = Path("podcast_checker.db")
    
    LOUDNESS_TARGET: float = -16.0
    LOUDNESS_TOLERANCE: float = 2.0
    LOUDNESS_MIN: float = -24.0
    LOUDNESS_MAX: float = -12.0
    
    COVER_MIN_WIDTH: int = 1400
    COVER_MAX_WIDTH: int = 3000
    COVER_MIN_HEIGHT: int = 1400
    COVER_MAX_HEIGHT: int = 3000
    COVER_ASPECT_RATIO_TOLERANCE: float = 0.01
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
