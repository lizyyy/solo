from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "Production Call Sheet Validator"
    DATABASE_URL: str = "sqlite:///./production.db"
    UPLOAD_DIR: Path = Path("./uploads")
    MAX_NIGHT_SHIFT_HOURS: float = 12.0
    MIN_TRANSFER_MINUTES: int = 30

    class Config:
        case_sensitive = True


settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
