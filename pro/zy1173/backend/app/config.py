from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "GPT原理沙盘"
    VERSION: str = "1.0.0"
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    EXPERIMENTS_DIR: Path = DATA_DIR / "experiments"
    CORPUS_DIR: Path = DATA_DIR / "corpus"
    FINE_TUNE_DIR: Path = DATA_DIR / "finetune"
    
    MAX_CONTEXT_WINDOW: int = 4096
    DEFAULT_TEMPERATURE: float = 0.7
    DEFAULT_TOP_P: float = 0.9
    DEFAULT_MAX_TOKENS: int = 100
    
    MODEL_NAME: str = "gpt2"
    DEVICE: str = "cpu"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.EXPERIMENTS_DIR.mkdir(parents=True, exist_ok=True)
settings.CORPUS_DIR.mkdir(parents=True, exist_ok=True)
settings.FINE_TUNE_DIR.mkdir(parents=True, exist_ok=True)
