import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class FontLicense(BaseModel):
    font_name: str
    font_hash: Optional[str] = None
    license_type: str
    allowed_usage: List[str] = Field(default_factory=lambda: ["print", "web", "presentation"])
    allowed_regions: List[str] = Field(default_factory=lambda: ["CN", "US", "EU"])
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_perpetual: bool = False
    authorized_for: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class Client(BaseModel):
    client_id: str
    client_name: str
    default_region: str = "CN"
    allowed_fonts: List[str] = Field(default_factory=list)
    blacklisted_fonts: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class Project(BaseModel):
    project_id: str
    project_name: str
    client_id: str
    usage_type: List[str] = Field(default_factory=lambda: ["print"])
    region: str = "CN"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    fonts: List[str] = Field(default_factory=list)
    output_directories: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class AuditConfig(BaseModel):
    version: str = "1.0"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    fonts: Dict[str, FontLicense] = Field(default_factory=dict)
    clients: Dict[str, Client] = Field(default_factory=dict)
    projects: Dict[str, Project] = Field(default_factory=dict)
    default_allowed_fonts: List[str] = Field(default_factory=list)
    default_blacklisted_fonts: List[str] = Field(default_factory=list)


class ConfigManager:
    DEFAULT_CONFIG_NAME = "font-auditor.json"
    
    def __init__(self, config_dir: Optional[Path] = None):
        if config_dir is None:
            config_dir = Path.cwd()
        self.config_dir = config_dir
        self.config_path = config_dir / self.DEFAULT_CONFIG_NAME
        self._config: Optional[AuditConfig] = None
    
    def init_config(self) -> AuditConfig:
        config = AuditConfig()
        self._config = config
        self.save()
        return config
    
    def load(self) -> AuditConfig:
        if self._config is not None:
            return self._config
        
        if not self.config_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {self.config_path}")
        
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        self._config = AuditConfig.model_validate(data)
        return self._config
    
    def save(self) -> None:
        if self._config is None:
            raise ValueError("配置尚未初始化")
        
        self._config.updated_at = datetime.now().isoformat()
        
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(self._config.model_dump(), f, indent=2, ensure_ascii=False)
    
    def add_font(self, font: FontLicense) -> None:
        config = self.load()
        config.fonts[font.font_name] = font
        self.save()
    
    def add_client(self, client: Client) -> None:
        config = self.load()
        config.clients[client.client_id] = client
        self.save()
    
    def add_project(self, project: Project) -> None:
        config = self.load()
        config.projects[project.project_id] = project
        self.save()
    
    def get_font(self, font_name: str) -> Optional[FontLicense]:
        config = self.load()
        return config.fonts.get(font_name)
    
    def get_client(self, client_id: str) -> Optional[Client]:
        config = self.load()
        return config.clients.get(client_id)
    
    def get_project(self, project_id: str) -> Optional[Project]:
        config = self.load()
        return config.projects.get(project_id)
