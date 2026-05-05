"""
配置管理模块
处理工作目录、配置文件和默认设置
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class Config:
    """配置类，存储所有配置项"""
    
    work_dir: str = "."
    samples_dir: str = "samples"
    scripts_dir: str = "scripts"
    snapshots_dir: str = "snapshots"
    gc_logs_dir: str = "gc_logs"
    ref_json_dir: str = "ref_json"
    database_path: str = "memprofiler.db"
    output_dir: str = "output"
    
    analysis: Dict[str, Any] = field(default_factory=lambda: {
        "max_objects": 10000,
        "min_size_bytes": 1024,
        "enable_cycle_detection": True,
        "enable_weakref_analysis": True,
        "enable_cache_detection": True,
    })
    
    export: Dict[str, Any] = field(default_factory=lambda: {
        "default_format": "markdown",
        "include_evidence": True,
        "include_suggestions": True,
    })
    
    def __post_init__(self):
        """初始化后处理，确保所有路径都是绝对路径"""
        if not os.path.isabs(self.work_dir):
            self.work_dir = os.path.abspath(self.work_dir)
        
        self._resolve_paths()
    
    def _resolve_paths(self):
        """解析所有相对路径为绝对路径"""
        base = Path(self.work_dir)
        
        self.samples_dir = str(base / self.samples_dir)
        self.scripts_dir = str(Path(self.samples_dir) / self.scripts_dir)
        self.snapshots_dir = str(Path(self.samples_dir) / self.snapshots_dir)
        self.gc_logs_dir = str(Path(self.samples_dir) / self.gc_logs_dir)
        self.ref_json_dir = str(Path(self.samples_dir) / self.ref_json_dir)
        self.database_path = str(base / self.database_path)
        self.output_dir = str(base / self.output_dir)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Config":
        """从字典创建配置"""
        return cls(**data)
    
    def save(self, path: Optional[str] = None):
        """保存配置到文件"""
        if path is None:
            path = os.path.join(self.work_dir, ".memprofiler.json")
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
    
    @classmethod
    def load(cls, path: Optional[str] = None) -> "Config":
        """从文件加载配置"""
        if path is None:
            path = os.path.join(os.getcwd(), ".memprofiler.json")
        
        if not os.path.exists(path):
            return cls()
        
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return cls.from_dict(data)
    
    def ensure_directories(self):
        """确保所有必要的目录存在"""
        directories = [
            self.work_dir,
            self.samples_dir,
            self.scripts_dir,
            self.snapshots_dir,
            self.gc_logs_dir,
            self.ref_json_dir,
            self.output_dir,
        ]
        
        for directory in directories:
            os.makedirs(directory, exist_ok=True)
    
    def get_scripts_files(self) -> list:
        """获取所有脚本文件"""
        if not os.path.exists(self.scripts_dir):
            return []
        
        return [
            os.path.join(self.scripts_dir, f)
            for f in os.listdir(self.scripts_dir)
            if f.endswith(".py")
        ]
    
    def get_snapshots_files(self) -> list:
        """获取所有快照文件"""
        if not os.path.exists(self.snapshots_dir):
            return []
        
        return [
            os.path.join(self.snapshots_dir, f)
            for f in os.listdir(self.snapshots_dir)
            if f.endswith((".snap", ".txt"))
        ]
    
    def get_gc_logs_files(self) -> list:
        """获取所有GC日志文件"""
        if not os.path.exists(self.gc_logs_dir):
            return []
        
        return [
            os.path.join(self.gc_logs_dir, f)
            for f in os.listdir(self.gc_logs_dir)
            if f.endswith(".log")
        ]
    
    def get_ref_json_files(self) -> list:
        """获取所有引用关系JSON文件"""
        if not os.path.exists(self.ref_json_dir):
            return []
        
        return [
            os.path.join(self.ref_json_dir, f)
            for f in os.listdir(self.ref_json_dir)
            if f.endswith(".json")
        ]
