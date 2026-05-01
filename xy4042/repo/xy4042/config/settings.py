import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import List


@dataclass
class Settings:
    app_name: str = "矫形取模适配台"
    app_version: str = "1.0.0"
    
    base_dir: Path = field(default_factory=lambda: Path.home() / ".orthotics_station")
    data_dir: Path = field(default=None)
    db_path: Path = field(default=None)
    attachments_dir: Path = field(default=None)
    temp_dir: Path = field(default=None)
    
    allowed_attachment_types: List[str] = field(default_factory=lambda: [
        ".jpg", ".jpeg", ".png", ".bmp", ".gif",
        ".stl", ".obj", ".ply",
        ".pdf",
        ".csv", ".txt"
    ])
    
    image_types: List[str] = field(default_factory=lambda: [
        ".jpg", ".jpeg", ".png", ".bmp", ".gif"
    ])
    
    scan_types: List[str] = field(default_factory=lambda: [
        ".stl", ".obj", ".ply"
    ])
    
    side_enum: List[str] = field(default_factory=lambda: ["左侧", "右侧", "双侧"])
    
    status_enum: List[str] = field(default_factory=lambda: [
        "待取模", "待设计", "制作中", "待试穿", "需返修", "已交付"
    ])
    
    def __post_init__(self):
        if self.data_dir is None:
            self.data_dir = self.base_dir / "data"
        if self.db_path is None:
            self.db_path = self.data_dir / "orthotics.db"
        if self.attachments_dir is None:
            self.attachments_dir = self.data_dir / "attachments"
        if self.temp_dir is None:
            self.temp_dir = self.data_dir / "temp"
        
        self.ensure_directories()
    
    def ensure_directories(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.attachments_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)


_settings: Settings = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def set_settings(settings: Settings) -> None:
    global _settings
    _settings = settings
