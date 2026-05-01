import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional


CONFIG_FILENAME = "track-cleaner-config.json"


@dataclass
class AppConfig:
    timezone: str = "Asia/Shanghai"
    speed_threshold: float = 15.0
    breakpoint_threshold: float = 300.0
    elevation_spike_threshold: float = 100.0
    default_export_dir: str = "./exports"
    data_dir: str = "./data"
    history_db: str = "track-cleaner-history.db"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "AppConfig":
        return cls(**data)


def get_default_config() -> AppConfig:
    return AppConfig()


def load_config(config_path: Optional[Path] = None) -> AppConfig:
    if config_path is None:
        config_path = Path.cwd() / CONFIG_FILENAME
    
    if not config_path.exists():
        return get_default_config()
    
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return AppConfig.from_dict(data)
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        print(f"警告: 配置文件格式错误，使用默认配置。错误: {e}")
        return get_default_config()


def save_config(config: AppConfig, config_path: Optional[Path] = None) -> Path:
    if config_path is None:
        config_path = Path.cwd() / CONFIG_FILENAME
    
    data = config.to_dict()
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    return config_path
