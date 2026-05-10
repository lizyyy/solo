from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "Data Lineage Change API"
    version: str = "0.1.0"
    
    database_url: str = "sqlite:///./data_lineage.db"
    
    max_history_records: int = 1000
    
    enable_alerts: bool = True
    alert_channel: str = "console"
    
    class Config:
        env_file = ".env"


settings = Settings()
