from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    INPUT_DIR: str = os.path.join(os.path.dirname(__file__), "input")
    OUTPUT_DIR: str = os.path.join(os.path.dirname(__file__), "output")
    DATA_DIR: str = os.path.join(os.path.dirname(__file__), "data")
    LOGS_DIR: str = os.path.join(os.path.dirname(__file__), "logs")
    
    SCAN_INTERVAL: int = 10
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    MIN_PAPER_STOCK: int = 100
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

def ensure_dirs():
    for dir_path in [
        settings.INPUT_DIR,
        settings.OUTPUT_DIR,
        settings.DATA_DIR,
        settings.LOGS_DIR
    ]:
        os.makedirs(dir_path, exist_ok=True)
