from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "响应字段裁剪器服务"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite:///./data/app.db"
    DATA_DIR: Path = Path("./data")
    REPORTS_DIR: Path = Path("./data/reports")
    EXPORT_DIR: Path = Path("./data/exports")
    SAMPLES_DIR: Path = Path("./data/samples")

    class Config:
        env_file = ".env"


settings = Settings()

for directory in [settings.DATA_DIR, settings.REPORTS_DIR, settings.EXPORT_DIR, settings.SAMPLES_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
