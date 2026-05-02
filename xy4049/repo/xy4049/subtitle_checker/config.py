"""配置管理模块"""

import json
import os
from pathlib import Path
from typing import Optional

from .models import Language, ProjectConfig


class ConfigManager:
    CONFIG_FILENAME = "subtitle-checker.json"

    def __init__(self, project_dir: Optional[Path] = None):
        self.project_dir = project_dir or Path.cwd()
        self.config_path = self.project_dir / self.CONFIG_FILENAME

    def init_project(
        self,
        languages: list[Language] = None,
        frame_rate: float = 25.0,
        max_reading_speed_zh: float = 6.0,
        max_reading_speed_en: float = 12.0,
        min_subtitle_gap_ms: int = 40,
        output_directory: str = "dist",
        platform_templates: dict[str, str] = None,
    ) -> ProjectConfig:
        if languages is None:
            languages = [Language.ZH, Language.EN]

        config = ProjectConfig(
            languages=languages,
            frame_rate=frame_rate,
            max_reading_speed_zh=max_reading_speed_zh,
            max_reading_speed_en=max_reading_speed_en,
            min_subtitle_gap_ms=min_subtitle_gap_ms,
            output_directory=output_directory,
            platform_name_templates=platform_templates or {},
        )

        self._create_directories(config)
        self.save_config(config)
        return config

    def _create_directories(self, config: ProjectConfig):
        directories = [
            self.project_dir / config.output_directory,
            self.project_dir / config.quarantine_directory,
            self.project_dir / config.import_directory,
            self.project_dir / config.history_directory,
        ]
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)

    def load_config(self) -> ProjectConfig:
        if not self.config_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {self.config_path}")

        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return ProjectConfig(**data)

    def save_config(self, config: ProjectConfig):
        self.config_path.parent.mkdir(parents=True, exist_ok=True)

        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, ensure_ascii=False, indent=2, default=str)

    def update_config(self, **kwargs) -> ProjectConfig:
        config = self.load_config()

        for key, value in kwargs.items():
            if hasattr(config, key):
                setattr(config, key, value)

        self.save_config(config)
        return config

    def is_initialized(self) -> bool:
        return self.config_path.exists()

    def get_output_dir(self) -> Path:
        config = self.load_config()
        return self.project_dir / config.output_directory

    def get_quarantine_dir(self) -> Path:
        config = self.load_config()
        return self.project_dir / config.quarantine_directory

    def get_import_dir(self) -> Path:
        config = self.load_config()
        return self.project_dir / config.import_directory

    def get_history_dir(self) -> Path:
        config = self.load_config()
        return self.project_dir / config.history_directory
