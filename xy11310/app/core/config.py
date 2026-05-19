from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "社区食堂配餐管理系统"
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/canteen.db"
    
    SENSITIVE_FIELDS: list = ["phone", "id_card", "address", "emergency_contact"]
    MASK_CHAR: str = "*"
    
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = f"{BASE_DIR}/logs/canteen.log"
    
    class Config:
        case_sensitive = True


settings = Settings()
