from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "租户配额回收服务"
    
    BASE_DIR: Path = Path(__file__).parent.parent
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/data/quota_recycle.db"
    
    MATERIAL_DOWNLOAD_TIMEOUT: int = 30
    MAX_RETRY_COUNT: int = 3
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
