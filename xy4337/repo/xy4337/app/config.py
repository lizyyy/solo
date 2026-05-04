from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite+aiosqlite:///./pottery.db"
    
    KILN_MAX_CAPACITY: int = 50
    
    TEMPERATURE_ZONES: list[str] = ["low", "mid", "high"]
    TEMPERATURE_RANGES: dict[str, tuple[int, int]] = {
        "low": (800, 1000),
        "mid": (1000, 1250),
        "high": (1250, 1400),
    }
    
    GLAZE_INCOMPATIBILITIES: dict[str, list[str]] = {
        "lead_based": ["copper_based", "alkali_based"],
        "copper_based": ["lead_based", "manganese_based"],
        "manganese_based": ["copper_based", "zinc_based"],
        "zinc_based": ["manganese_based", "alkali_based"],
        "alkali_based": ["lead_based", "zinc_based"],
    }
    
    FIRING_RESULTS: list[str] = ["success", "partial_success", "failure"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
