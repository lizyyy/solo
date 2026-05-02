import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


@dataclass
class RiskThresholds:
    compliance_rate_low: float = 0.5
    compliance_rate_warning: float = 0.7
    pain_increase_threshold: int = 2
    pain_high_level: int = 7
    movement_volatility_threshold: float = 0.25
    missed_days_warning: int = 2
    missed_days_critical: int = 4


@dataclass
class AppConfig:
    APP_NAME: str = "训练随访趋势复盘台"
    VERSION: str = "1.0.0"
    
    DATA_DIR: Path = Path(__file__).parent / "data"
    RAW_DATA_DIR: Path = DATA_DIR / "raw"
    PROCESSED_DATA_DIR: Path = DATA_DIR / "processed"
    SAMPLE_DATA_DIR: Path = DATA_DIR / "sample"
    EXPORT_DIR: Path = DATA_DIR / "export"
    
    MAX_FILE_SIZE_MB: int = 50
    SUPPORTED_FILE_TYPES: List[str] = ("csv",)
    
    DEFAULT_RISK_THRESHOLDS: RiskThresholds = RiskThresholds()
    
    COLORS: Dict[str, str] = {
        "primary": "#1f77b4",
        "success": "#2ca02c",
        "warning": "#ff7f0e",
        "danger": "#dc3912",
        "info": "#17becf",
    }
    
    RISK_LEVELS: Dict[str, str] = {
        "low": "低风险",
        "medium": "中风险",
        "high": "高风险",
        "critical": "危急风险",
    }
    
    RISK_COLORS: Dict[str, str] = {
        "low": "#2ca02c",
        "medium": "#ff7f0e",
        "high": "#dc3912",
        "critical": "#9400d3",
    }


config = AppConfig()


def ensure_directories():
    for dir_path in [
        config.DATA_DIR,
        config.RAW_DATA_DIR,
        config.PROCESSED_DATA_DIR,
        config.SAMPLE_DATA_DIR,
        config.EXPORT_DIR,
    ]:
        dir_path.mkdir(parents=True, exist_ok=True)
