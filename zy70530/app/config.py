from pathlib import Path

class Settings:
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "数据质量例外管理API"
    DATABASE_URL: str = "sqlite:///./data_quality_exception.db"

settings = Settings()

BASE_DIR = Path(__file__).parent.parent
EXPORT_DIR = BASE_DIR / "exports"
EXPORT_DIR.mkdir(exist_ok=True)
