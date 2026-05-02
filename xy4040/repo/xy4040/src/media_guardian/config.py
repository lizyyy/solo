import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, ValidationError


class FileTypeConfig(BaseModel):
    video_extensions: list[str] = Field(
        default_factory=lambda: [".mp4", ".mov", ".mxf", ".avi", ".mkv", ".prores", ".r3d"]
    )
    audio_extensions: list[str] = Field(
        default_factory=lambda: [".wav", ".aiff", ".mp3", ".flac", ".m4a", ".bwf"]
    )
    proxy_extensions: list[str] = Field(
        default_factory=lambda: [".proxy.mp4", ".proxy.mov", "_proxy.mp4", "_proxy.mov"]
    )
    sidecar_extensions: list[str] = Field(
        default_factory=lambda: [".srt", ".json", ".xml", ".csv", ".txt"]
    )


class ArchiveConfig(BaseModel):
    path_template: str = "{shoot_date}/{camera}/{card_number}"
    date_format: str = "%Y-%m-%d"
    create_subdirs: bool = True


class HashConfig(BaseModel):
    algorithm: str = "sha256"
    chunk_size: int = 8192


class ValidationRules(BaseModel):
    check_sequence_gaps: bool = True
    check_sidecar_presence: bool = True
    check_timecode_overlap: bool = True
    check_duplicate_filenames: bool = True
    check_disk_space: bool = True
    min_free_space_gb: int = 50


class ProjectConfig(BaseModel):
    project_name: str = "Untitled_Project"
    shoot_date: str | None = None
    default_camera: str = "A"
    file_types: FileTypeConfig = Field(default_factory=FileTypeConfig)
    archive: ArchiveConfig = Field(default_factory=ArchiveConfig)
    hash: HashConfig = Field(default_factory=HashConfig)
    validation: ValidationRules = Field(default_factory=ValidationRules)

    class Config:
        extra = "forbid"


DEFAULT_CONFIG = ProjectConfig()


@dataclass
class ConfigManager:
    config_path: Path | None = None
    _config: ProjectConfig = field(default_factory=lambda: DEFAULT_CONFIG.model_copy())

    def __post_init__(self) -> None:
        if self.config_path and self.config_path.exists():
            self.load_config(self.config_path)

    def load_config(self, path: Path) -> None:
        if path.suffix == ".json":
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        elif path.suffix in (".toml", ".yaml", ".yml"):
            if path.suffix == ".toml":
                import tomllib
                with open(path, "rb") as f:
                    data = tomllib.load(f)
            else:
                import yaml
                with open(path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
        else:
            raise ValueError(f"不支持的配置文件格式: {path.suffix}")

        try:
            self._config = ProjectConfig(**data)
        except ValidationError as e:
            raise ValueError(f"配置文件格式错误: {e}")

    def save_config(self, path: Path | None = None) -> None:
        save_path = path or self.config_path
        if not save_path:
            raise ValueError("未指定配置文件路径")

        data = self._config.model_dump()

        if save_path.suffix == ".json":
            with open(save_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        elif save_path.suffix == ".toml":
            import tomli_w
            with open(save_path, "wb") as f:
                tomli_w.dump(data, f)
        elif save_path.suffix in (".yaml", ".yml"):
            import yaml
            with open(save_path, "w", encoding="utf-8") as f:
                yaml.dump(data, f, allow_unicode=True, default_flow_style=False)
        else:
            raise ValueError(f"不支持的配置文件格式: {save_path.suffix}")

    @property
    def config(self) -> ProjectConfig:
        return self._config

    def get_shoot_date(self) -> str:
        if self._config.shoot_date:
            return self._config.shoot_date
        return datetime.now().strftime(self._config.archive.date_format)

    def generate_archive_path(
        self,
        base_path: Path,
        shoot_date: str | None = None,
        camera: str | None = None,
        card_number: str | None = None,
    ) -> Path:
        template = self._config.archive.path_template
        date = shoot_date or self.get_shoot_date()
        cam = camera or self._config.default_camera
        card = card_number or "001"

        path_str = template.format(
            shoot_date=date,
            camera=cam,
            card_number=card,
            project_name=self._config.project_name,
        )

        return base_path / path_str

    def is_video_file(self, path: Path) -> bool:
        ext = path.suffix.lower()
        name = path.name.lower()

        for proxy_ext in self._config.file_types.proxy_extensions:
            if proxy_ext.lower() in name:
                return False

        return ext in self._config.file_types.video_extensions

    def is_audio_file(self, path: Path) -> bool:
        ext = path.suffix.lower()
        return ext in self._config.file_types.audio_extensions

    def is_proxy_file(self, path: Path) -> bool:
        name = path.name.lower()
        for proxy_ext in self._config.file_types.proxy_extensions:
            if proxy_ext.lower() in name:
                return True
        return False

    def is_sidecar_file(self, path: Path) -> bool:
        ext = path.suffix.lower()
        return ext in self._config.file_types.sidecar_extensions

    def get_file_category(self, path: Path) -> str:
        if self.is_proxy_file(path):
            return "proxy"
        if self.is_video_file(path):
            return "video"
        if self.is_audio_file(path):
            return "audio"
        if self.is_sidecar_file(path):
            return "sidecar"
        return "other"


def find_config_file(start_path: Path) -> Path | None:
    config_names = [
        "media_guardian.json",
        "media_guardian.toml",
        "media_guardian.yaml",
        "media_guardian.yml",
        ".media_guardian.json",
        ".media_guardian.toml",
    ]

    current = start_path
    while True:
        for name in config_names:
            config_path = current / name
            if config_path.exists():
                return config_path

        parent = current.parent
        if parent == current:
            break
        current = parent

    return None


def get_config_manager(config_path: Path | None = None, working_dir: Path | None = None) -> ConfigManager:
    if config_path:
        return ConfigManager(config_path=Path(config_path))

    wd = working_dir or Path.cwd()
    found = find_config_file(wd)
    if found:
        return ConfigManager(config_path=found)

    return ConfigManager()
