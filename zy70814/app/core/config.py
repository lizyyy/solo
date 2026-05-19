from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./port_reconciliation.db"
    TIMEZONE: str = "Asia/Shanghai"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024
    EXPORT_DIR: Path = Path("./exports")
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "港口调度对账服务"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

settings.EXPORT_DIR.mkdir(parents=True, exist_ok=True)
