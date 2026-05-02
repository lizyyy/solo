import json
import os
from pathlib import Path
from typing import List, Optional, Set

from pydantic import BaseModel, Field, field_validator


DEFAULT_CONFIG_NAME = ".field-sync.json"
DEFAULT_LOG_DIR = ".field-sync/logs"
DEFAULT_MANIFEST_DIR = ".field-sync/manifests"
DEFAULT_PLAN_DIR = ".field-sync/plans"
DEFAULT_JOURNAL_DIR = ".field-sync/journals"
DEFAULT_QUARANTINE_DIR = ".field-sync/quarantine"


class ConflictStrategy(BaseModel):
    on_case_conflict: str = Field(default="quarantine", description="大小写冲突处理策略: quarantine, skip, prefer_left, prefer_right")
    on_content_conflict: str = Field(default="quarantine", description="内容冲突处理策略: quarantine, skip, prefer_newer, prefer_left, prefer_right")
    on_mtime_drift: str = Field(default="warn", description="mtime漂移处理策略: warn, ignore")
    on_renamed_candidate: str = Field(default="ask", description="重命名候选处理策略: ask, merge, quarantine")
    
    @field_validator('on_case_conflict')
    @classmethod
    def validate_case_conflict(cls, v: str) -> str:
        valid = ['quarantine', 'skip', 'prefer_left', 'prefer_right']
        if v not in valid:
            raise ValueError(f"on_case_conflict must be one of {valid}")
        return v
    
    @field_validator('on_content_conflict')
    @classmethod
    def validate_content_conflict(cls, v: str) -> str:
        valid = ['quarantine', 'skip', 'prefer_newer', 'prefer_left', 'prefer_right']
        if v not in valid:
            raise ValueError(f"on_content_conflict must be one of {valid}")
        return v


class SyncConfig(BaseModel):
    version: str = Field(default="1.0", description="配置版本")
    left_dir: str = Field(description="左侧工作目录（笔记本端）")
    right_dir: str = Field(description="右侧备份目录（移动硬盘）")
    ignore_patterns: List[str] = Field(default_factory=list, description="忽略的文件/目录模式（支持glob）")
    allowed_extensions: List[str] = Field(default_factory=list, description="允许的文件扩展名列表（空表示允许所有）")
    conflict_strategy: ConflictStrategy = Field(default_factory=ConflictStrategy, description="冲突处理策略")
    log_dir: str = Field(default=DEFAULT_LOG_DIR, description="日志目录")
    manifest_dir: str = Field(default=DEFAULT_MANIFEST_DIR, description="manifest存储目录")
    plan_dir: str = Field(default=DEFAULT_PLAN_DIR, description="计划存储目录")
    journal_dir: str = Field(default=DEFAULT_JOURNAL_DIR, description="journal存储目录")
    quarantine_dir: str = Field(default=DEFAULT_QUARANTINE_DIR, description="隔离目录")
    created_at: float = Field(default_factory=lambda: os.path.getctime(__file__) if os.path.exists(__file__) else 0.0)
    
    @field_validator('left_dir', 'right_dir')
    @classmethod
    def validate_directory(cls, v: str) -> str:
        return v.rstrip('/\\')
    
    @field_validator('allowed_extensions')
    @classmethod
    def normalize_extensions(cls, v: List[str]) -> List[str]:
        return [ext.lower().lstrip('.') for ext in v]
    
    def get_ignore_set(self) -> Set[str]:
        return set(self.ignore_patterns)
    
    def is_extension_allowed(self, ext: str) -> bool:
        if not self.allowed_extensions:
            return True
        return ext.lower().lstrip('.') in [e.lower() for e in self.allowed_extensions]
    
    def save(self, path: str) -> None:
        """保存配置到文件"""
        config_path = Path(path)
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(self.model_dump(), f, indent=2, ensure_ascii=False)
    
    @classmethod
    def load(cls, path: str) -> 'SyncConfig':
        """从文件加载配置"""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return cls(**data)


def find_config(start_dir: str = '.') -> Optional[Path]:
    """在目录树中查找配置文件"""
    current = Path(start_dir).resolve()
    while True:
        config_path = current / DEFAULT_CONFIG_NAME
        if config_path.exists():
            return config_path
        parent = current.parent
        if parent == current:
            return None
        current = parent


def get_default_ignore_patterns() -> List[str]:
    """获取默认忽略模式"""
    return [
        ".*",
        "__pycache__",
        "*.tmp",
        "*.temp",
        "~$*",
        "*.~lock.*",
        "Thumbs.db",
        ".DS_Store",
    ]


def get_default_allowed_extensions() -> List[str]:
    """获取默认允许的文件扩展名（测绘相关）"""
    return [
        "jpg", "jpeg", "png", "tif", "tiff", "bmp",
        "csv", "txt", "json", "xml", "yaml", "yml",
        "gpx", "kml", "kmz", "shp", "dbf", "prj", "shx",
        "pdf", "doc", "docx", "xls", "xlsx",
        "zip", "rar", "7z",
    ]
