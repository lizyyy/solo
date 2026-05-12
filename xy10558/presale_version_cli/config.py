from __future__ import annotations

import os
from pathlib import Path


class Config:
    DEFAULT_CONFIG_DIR = ".presale"
    STATE_FILE = "state.json"
    AUDIT_FILE = "audit.json"
    CACHE_DIR = "cache"
    
    REQUIRED_ATTACHMENTS = [
        "技术架构",
        "部署方案",
        "接口清单",
    ]
    
    @classmethod
    def get_config_path(cls, project_dir: Path) -> Path:
        return project_dir / cls.DEFAULT_CONFIG_DIR
    
    @classmethod
    def get_state_path(cls, project_dir: Path) -> Path:
        return cls.get_config_path(project_dir) / cls.STATE_FILE
    
    @classmethod
    def get_audit_path(cls, project_dir: Path) -> Path:
        return cls.get_config_path(project_dir) / cls.AUDIT_FILE
    
    @classmethod
    def get_cache_path(cls, project_dir: Path) -> Path:
        return cls.get_config_path(project_dir) / cls.CACHE_DIR
    
    @classmethod
    def is_initialized(cls, project_dir: Path) -> bool:
        return cls.get_state_path(project_dir).exists()
