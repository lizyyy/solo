from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "泵房巡检管理系统"
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    LOG_DIR: Path = BASE_DIR / "logs"
    
    DATABASE_URL: str = f"sqlite:///{DATA_DIR}/pump_inspection.db"
    
    SECRET_KEY: str = "your-secret-key-change-in-production-pump-inspection-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    SENSITIVE_FIELDS: list = ["phone", "id_card", "password", "email"]
    
    class Config:
        case_sensitive = True


settings = Settings()

settings.DATA_DIR.mkdir(exist_ok=True)
settings.LOG_DIR.mkdir(exist_ok=True)
