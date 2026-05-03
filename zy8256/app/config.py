from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "船厂涂装安全管理系统"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    
    DATABASE_URL: str = "sqlite:///./painting_safety.db"
    
    DATA_DIR: Path = Path("./data")
    REPORTS_DIR: Path = Path("./reports")
    
    VOC_STANDARD_PPM: float = 500.0
    VOC_STANDARD_MG_M3: float = 1500.0
    VENTILATION_REQUIRED_CHANGES_PER_HOUR: float = 30.0
    SENSOR_SAMPLE_INTERVAL_MINUTES: int = 5
    SENSOR_MISS_THRESHOLD_MINUTES: int = 15
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    def model_post_init(self, __context) -> None:
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.REPORTS_DIR.mkdir(parents=True, exist_ok=True)


settings = Settings()
