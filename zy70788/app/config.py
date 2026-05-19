from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./webhook_fixture.db"
    FIXTURE_DIR: Path = Path("./fixtures")
    REPORT_DIR: Path = Path("./reports")
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Webhook Fixture Recording Service"

    class Config:
        case_sensitive = True


settings = Settings()

settings.FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
settings.REPORT_DIR.mkdir(parents=True, exist_ok=True)
