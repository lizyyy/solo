"""上下文模型"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class Context:
    """上下文模型 - 表示应用程序中的一个工作上下文（如编辑器、图层面板等）"""
    
    # 基本信息
    id: str = ""
    name: str = ""
    display_name: str = ""
    description: str = ""
    
    # 所属应用
    application_id: str = ""
    
    # 优先级 - 用于解决冲突时确定优先级
    priority: int = 100  # 数字越大优先级越高
    is_global: bool = False  # 是否为全局上下文
    
    # 快捷键列表
    shortcut_ids: List[str] = field(default_factory=list)
    
    # 元数据
    source_file: str = ""
    import_time: Optional[float] = None
    
    # 用户标记
    is_active: bool = True
    user_notes: str = ""
    
    def __post_init__(self):
        if not self.id:
            import hashlib
            import time
            content = f"{self.application_id}:{self.name}:{time.time()}"
            self.id = hashlib.md5(content.encode()).hexdigest()[:12]
        if not self.display_name:
            self.display_name = self.name
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "application_id": self.application_id,
            "priority": self.priority,
            "is_global": self.is_global,
            "shortcut_ids": self.shortcut_ids,
            "source_file": self.source_file,
            "import_time": self.import_time,
            "is_active": self.is_active,
            "user_notes": self.user_notes,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Context":
        """从字典创建"""
        ctx = cls()
        ctx.id = data.get("id", "")
        ctx.name = data.get("name", "")
        ctx.display_name = data.get("display_name", "")
        ctx.description = data.get("description", "")
        ctx.application_id = data.get("application_id", "")
        ctx.priority = data.get("priority", 100)
        ctx.is_global = data.get("is_global", False)
        ctx.shortcut_ids = data.get("shortcut_ids", [])
        ctx.source_file = data.get("source_file", "")
        ctx.import_time = data.get("import_time")
        ctx.is_active = data.get("is_active", True)
        ctx.user_notes = data.get("user_notes", "")
        
        if not ctx.display_name:
            ctx.display_name = ctx.name
        
        return ctx
