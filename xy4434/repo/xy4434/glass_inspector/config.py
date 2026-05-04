"""配置管理"""

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ImageConfig:
    supported_formats: List[str] = field(
        default_factory=lambda: [".jpg", ".jpeg", ".png", ".bmp", ".tiff"]
    )
    resize_size: tuple = (256, 256)
    color_histogram_bins: int = 64
    contour_threshold: float = 0.5
    min_contour_area: int = 100


@dataclass
class AnalysisConfig:
    similarity_threshold: float = 0.7
    color_diff_threshold: float = 0.3
    bubble_area_threshold: float = 0.02
    min_group_size: int = 2
    max_groups: int = 20


@dataclass
class DatabaseConfig:
    db_path: str = "glass_inspector.db"
    echo: bool = False


@dataclass
class APIConfig:
    host: str = "127.0.0.1"
    port: int = 5000
    debug: bool = False


@dataclass
class Config:
    image: ImageConfig = field(default_factory=ImageConfig)
    analysis: AnalysisConfig = field(default_factory=AnalysisConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    api: APIConfig = field(default_factory=APIConfig)

    @classmethod
    def from_env(cls) -> "Config":
        config = cls()

        if db_path := os.getenv("GLASS_INSPECTOR_DB"):
            config.database.db_path = db_path
        if host := os.getenv("GLASS_INSPECTOR_HOST"):
            config.api.host = host
        if port := os.getenv("GLASS_INSPECTOR_PORT"):
            config.api.port = int(port)

        return config


_config: Optional[Config] = None


def get_config() -> Config:
    global _config
    if _config is None:
        _config = Config.from_env()
    return _config
