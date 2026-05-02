import json
from pathlib import Path
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class DeviceConfig(BaseModel):
    device_id: str
    name: str
    clock_offset_seconds: int = 0


class ZoneRule(BaseModel):
    zone_id: str
    name: str
    allowed_groups: List[str] = Field(default_factory=list)
    anti_passback: bool = True
    re_entry_minutes: int = 5


class ProjectConfig(BaseModel):
    name: str
    created_at: str
    updated_at: Optional[str] = None
    time_zone: str = "Asia/Shanghai"
    devices: List[DeviceConfig] = Field(default_factory=list)
    zones: List[ZoneRule] = Field(default_factory=list)
    data_dir: str = "data"
    output_dir: str = "output"


class ConfigManager:
    CONFIG_FILE = ".arbiter_config.json"

    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.config_path = project_dir / self.CONFIG_FILE

    def exists(self) -> bool:
        return self.config_path.exists()

    def load(self) -> ProjectConfig:
        if not self.exists():
            raise FileNotFoundError(f"项目配置不存在: {self.config_path}")
        
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return ProjectConfig(**data)

    def save(self, config: ProjectConfig):
        config.updated_at = datetime.now().isoformat()
        
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, indent=2, ensure_ascii=False)

    def init_project(self, name: str) -> ProjectConfig:
        config = ProjectConfig(
            name=name,
            created_at=datetime.now().isoformat()
        )
        
        data_dir = self.project_dir / config.data_dir
        output_dir = self.project_dir / config.output_dir
        data_dir.mkdir(exist_ok=True)
        output_dir.mkdir(exist_ok=True)
        
        (data_dir / "devices").mkdir(exist_ok=True)
        (data_dir / "permissions").mkdir(exist_ok=True)
        (data_dir / "zones").mkdir(exist_ok=True)
        
        self.save(config)
        return config

    def get_data_dir(self) -> Path:
        config = self.load()
        return self.project_dir / config.data_dir

    def get_output_dir(self) -> Path:
        config = self.load()
        return self.project_dir / config.output_dir
