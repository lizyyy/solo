"""快捷键数据模型"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from collections import namedtuple


class ModifierKey(Enum):
    """修饰键枚举"""
    # Windows/Linux 修饰键
    CTRL = "Ctrl"
    SHIFT = "Shift"
    ALT = "Alt"
    WIN = "Win"
    
    # Mac 修饰键
    CMD = "Cmd"      # Command
    OPTION = "Option" # Option/Alt
    CONTROL = "Control"  # Mac Control
    
    # 通用修饰键
    META = "Meta"


class ShortcutKey:
    """快捷键键值类"""
    
    # 标准键映射
    STANDARD_KEYS = {
        # 字母键
        "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
        "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
        # 数字键
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
        # 功能键
        "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
        # 导航键
        "tab", "enter", "return", "escape", "esc", "space", "backspace", "delete",
        "insert", "home", "end", "pageup", "pagedown", "up", "down", "left", "right",
        # 符号键
        "`", "-", "=", "[", "]", "\\", ";", "'", ",", ".", "/",
        # 小键盘
        "num0", "num1", "num2", "num3", "num4", "num5", "num6", "num7", "num8", "num9",
        "num*", "num+", "num-", "num.", "num/", "numlock",
    }
    
    def __init__(self, key: str, modifiers: Optional[List[str]] = None):
        self.key = key.lower().strip()
        self.modifiers = [m.strip().capitalize() for m in (modifiers or [])]
        self._normalize()
    
    def _normalize(self):
        """标准化修饰键"""
        normalized = []
        for mod in self.modifiers:
            # 标准化修饰键名称
            mod_lower = mod.lower()
            if mod_lower in ["ctrl", "control"]:
                normalized.append("Ctrl")
            elif mod_lower in ["shift"]:
                normalized.append("Shift")
            elif mod_lower in ["alt", "option"]:
                normalized.append("Alt")
            elif mod_lower in ["win", "windows", "cmd", "command", "meta"]:
                normalized.append("Cmd")
            else:
                normalized.append(mod)
        
        # 去重并排序以确保一致性
        self.modifiers = sorted(list(set(normalized)))
    
    def to_tuple(self) -> tuple:
        """转换为元组用于比较"""
        return (tuple(self.modifiers), self.key)
    
    def __eq__(self, other):
        if isinstance(other, ShortcutKey):
            return self.to_tuple() == other.to_tuple()
        return False
    
    def __hash__(self):
        return hash(self.to_tuple())
    
    def __str__(self):
        if self.modifiers:
            return "+".join(self.modifiers + [self.key.upper()])
        return self.key.upper()
    
    def __repr__(self):
        return f"ShortcutKey('{self.key}', modifiers={self.modifiers})"
    
    @classmethod
    def from_string(cls, shortcut_str: str) -> "ShortcutKey":
        """从字符串解析快捷键，如 'Ctrl+Shift+P'"""
        parts = shortcut_str.replace(" ", "").split("+")
        key = parts[-1]
        modifiers = parts[:-1] if len(parts) > 1 else []
        return cls(key, modifiers)
    
    def is_valid(self) -> bool:
        """检查是否为有效的快捷键"""
        return self.key in self.STANDARD_KEYS or self.key.isalpha() or self.key.isdigit()


@dataclass
class Shortcut:
    """快捷键模型 - 表示一个完整的快捷键配置"""
    
    # 基本信息
    id: str = ""
    name: str = ""
    description: str = ""
    action: str = ""
    
    # 快捷键组合
    primary_key: Optional[ShortcutKey] = None
    secondary_keys: List[ShortcutKey] = field(default_factory=list)
    
    # 平台信息
    platform: str = "all"  # "mac", "windows", "linux", "all"
    is_platform_specific: bool = False
    
    # 上下文信息
    context_id: str = ""
    application_id: str = ""
    
    # 宏信息
    is_macro: bool = False
    macro_commands: List[str] = field(default_factory=list)
    
    # 标记信息
    is_reserved: bool = False
    is_user_defined: bool = False
    user_notes: str = ""
    
    # 元数据
    source_file: str = ""
    source_format: str = ""  # "json", "csv", "xml"
    import_time: Optional[float] = None
    
    # 改键相关
    original_key: Optional[ShortcutKey] = None
    suggested_key: Optional[ShortcutKey] = None
    is_remapped: bool = False
    
    def __post_init__(self):
        if not self.id:
            import hashlib
            import time
            content = f"{self.application_id}:{self.context_id}:{self.name}:{time.time()}"
            self.id = hashlib.md5(content.encode()).hexdigest()[:12]
    
    def get_display_string(self) -> str:
        """获取显示用的快捷键字符串"""
        if self.primary_key:
            return str(self.primary_key)
        return "未设置"
    
    def get_all_keys(self) -> List[ShortcutKey]:
        """获取所有快捷键组合"""
        keys = []
        if self.primary_key:
            keys.append(self.primary_key)
        keys.extend(self.secondary_keys)
        return keys
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "action": self.action,
            "primary_key": str(self.primary_key) if self.primary_key else None,
            "secondary_keys": [str(k) for k in self.secondary_keys],
            "platform": self.platform,
            "is_platform_specific": self.is_platform_specific,
            "context_id": self.context_id,
            "application_id": self.application_id,
            "is_macro": self.is_macro,
            "macro_commands": self.macro_commands,
            "is_reserved": self.is_reserved,
            "is_user_defined": self.is_user_defined,
            "user_notes": self.user_notes,
            "source_file": self.source_file,
            "source_format": self.source_format,
            "import_time": self.import_time,
            "original_key": str(self.original_key) if self.original_key else None,
            "suggested_key": str(self.suggested_key) if self.suggested_key else None,
            "is_remapped": self.is_remapped,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Shortcut":
        """从字典创建"""
        shortcut = cls()
        shortcut.id = data.get("id", "")
        shortcut.name = data.get("name", "")
        shortcut.description = data.get("description", "")
        shortcut.action = data.get("action", "")
        
        if data.get("primary_key"):
            shortcut.primary_key = ShortcutKey.from_string(data["primary_key"])
        shortcut.secondary_keys = [
            ShortcutKey.from_string(k) for k in data.get("secondary_keys", [])
        ]
        
        shortcut.platform = data.get("platform", "all")
        shortcut.is_platform_specific = data.get("is_platform_specific", False)
        shortcut.context_id = data.get("context_id", "")
        shortcut.application_id = data.get("application_id", "")
        shortcut.is_macro = data.get("is_macro", False)
        shortcut.macro_commands = data.get("macro_commands", [])
        shortcut.is_reserved = data.get("is_reserved", False)
        shortcut.is_user_defined = data.get("is_user_defined", False)
        shortcut.user_notes = data.get("user_notes", "")
        shortcut.source_file = data.get("source_file", "")
        shortcut.source_format = data.get("source_format", "")
        shortcut.import_time = data.get("import_time")
        
        if data.get("original_key"):
            shortcut.original_key = ShortcutKey.from_string(data["original_key"])
        if data.get("suggested_key"):
            shortcut.suggested_key = ShortcutKey.from_string(data["suggested_key"])
        shortcut.is_remapped = data.get("is_remapped", False)
        
        return shortcut
