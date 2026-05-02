"""应用程序模型"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class Application:
    """应用程序模型 - 表示一个软件应用"""
    
    # 基本信息
    id: str = ""
    name: str = ""
    display_name: str = ""
    version: str = ""
    vendor: str = ""
    description: str = ""
    
    # 平台信息
    supported_platforms: List[str] = field(default_factory=lambda: ["mac", "windows"])
    primary_platform: str = "all"
    
    # 快捷键导出信息
    export_format: str = "json"  # "json", "csv", "xml"
    export_path_template: str = ""
    
    # 上下文列表
    context_ids: List[str] = field(default_factory=list)
    
    # 元数据
    source_file: str = ""
    import_time: Optional[float] = None
    last_modified: Optional[float] = None
    
    # 用户标记
    is_active: bool = True
    user_notes: str = ""
    
    # 系统保留键
    system_reserved_keys: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        if not self.id:
            import hashlib
            import time
            content = f"{self.name}:{self.version}:{time.time()}"
            self.id = hashlib.md5(content.encode()).hexdigest()[:12]
        if not self.display_name:
            self.display_name = self.name
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "version": self.version,
            "vendor": self.vendor,
            "description": self.description,
            "supported_platforms": self.supported_platforms,
            "primary_platform": self.primary_platform,
            "export_format": self.export_format,
            "export_path_template": self.export_path_template,
            "context_ids": self.context_ids,
            "source_file": self.source_file,
            "import_time": self.import_time,
            "last_modified": self.last_modified,
            "is_active": self.is_active,
            "user_notes": self.user_notes,
            "system_reserved_keys": self.system_reserved_keys,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Application":
        """从字典创建"""
        app = cls()
        app.id = data.get("id", "")
        app.name = data.get("name", "")
        app.display_name = data.get("display_name", "")
        app.version = data.get("version", "")
        app.vendor = data.get("vendor", "")
        app.description = data.get("description", "")
        app.supported_platforms = data.get("supported_platforms", ["mac", "windows"])
        app.primary_platform = data.get("primary_platform", "all")
        app.export_format = data.get("export_format", "json")
        app.export_path_template = data.get("export_path_template", "")
        app.context_ids = data.get("context_ids", [])
        app.source_file = data.get("source_file", "")
        app.import_time = data.get("import_time")
        app.last_modified = data.get("last_modified")
        app.is_active = data.get("is_active", True)
        app.user_notes = data.get("user_notes", "")
        app.system_reserved_keys = data.get("system_reserved_keys", [])
        
        if not app.display_name:
            app.display_name = app.name
        
        return app
