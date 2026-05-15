from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "版本提醒器服务"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    BASE_DIR: Path = Path(__file__).parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    FAILED_ITEMS_DIR: Path = BASE_DIR / "failed_items"
    REPORTS_DIR: Path = BASE_DIR / "reports"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.DATA_DIR.mkdir(exist_ok=True)
        self.FAILED_ITEMS_DIR.mkdir(exist_ok=True)
        self.REPORTS_DIR.mkdir(exist_ok=True)


settings = Settings()
