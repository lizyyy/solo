from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/rent_reduction.db"
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    EXPORT_DIR: Path = BASE_DIR / "exports"
    MAX_REDUCTION_DAYS: int = 180
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "商业地产租金减免审批系统"

    class Config:
        env_file = ".env"


settings = Settings()

settings.UPLOAD_DIR.mkdir(exist_ok=True)
settings.EXPORT_DIR.mkdir(exist_ok=True)
