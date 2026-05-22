from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "pharmacy-audit-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/data/pharmacy_audit.db"
    ATTACHMENT_DIR: Path = BASE_DIR / "attachments"
    LOG_DIR: Path = BASE_DIR / "logs"
    SAMPLE_DIR: Path = BASE_DIR / "samples"
    EXPORT_DIR: Path = BASE_DIR / "data" / "exports"

    class Config:
        case_sensitive = True


settings = Settings()

settings.ATTACHMENT_DIR.mkdir(parents=True, exist_ok=True)
settings.LOG_DIR.mkdir(parents=True, exist_ok=True)
settings.SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
settings.EXPORT_DIR.mkdir(parents=True, exist_ok=True)
