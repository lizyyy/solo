"""基础解析器 - 定义解析器接口"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from pathlib import Path
import time

from src.models import Application, Context, Shortcut


@dataclass
class ParseResult:
    """解析结果 - 包含解析出的所有数据"""
    
    # 解析状态
    success: bool = True
    error_message: str = ""
    
    # 解析出的数据
    application: Optional[Application] = None
    contexts: List[Context] = field(default_factory=list)
    shortcuts: List[Shortcut] = field(default_factory=list)
    
    # 元数据
    source_file: str = ""
    parse_time: float = field(default_factory=time.time)
    parser_name: str = ""
    
    # 警告信息
    warnings: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "success": self.success,
            "error_message": self.error_message,
            "application": self.application.to_dict() if self.application else None,
            "contexts": [c.to_dict() for c in self.contexts],
            "shortcuts": [s.to_dict() for s in self.shortcuts],
            "source_file": self.source_file,
            "parse_time": self.parse_time,
            "parser_name": self.parser_name,
            "warnings": self.warnings,
        }


class BaseParser(ABC):
    """基础解析器抽象类"""
    
    def __init__(self):
        self.supported_extensions: List[str] = []
        self.application_name: str = ""
        self.default_context: str = "global"
    
    @abstractmethod
    def can_parse(self, file_path: str) -> bool:
        """检查是否可以解析该文件"""
        pass
    
    @abstractmethod
    def parse(self, file_path: str) -> ParseResult:
        """解析文件并返回结果"""
        pass
    
    def parse_string(self, content: str) -> ParseResult:
        """从字符串解析 - 可选实现"""
        raise NotImplementedError("parse_string not implemented")
    
    def _get_file_extension(self, file_path: str) -> str:
        """获取文件扩展名"""
        return Path(file_path).suffix.lower().lstrip(".")
    
    def _create_default_context(self, app_id: str) -> Context:
        """创建默认上下文"""
        return Context(
            name=self.default_context,
            display_name="全局",
            application_id=app_id,
            is_global=True,
            priority=200,
        )
    
    def _normalize_shortcut_string(self, shortcut_str: str) -> str:
        """标准化快捷键字符串"""
        if not shortcut_str:
            return ""
        
        # 处理常见变体
        shortcut_str = shortcut_str.strip()
        shortcut_str = shortcut_str.replace(" ", "+")
        shortcut_str = shortcut_str.replace("++", "+")
        
        # 标准化修饰键
        replacements = {
            "command": "Cmd",
            "cmd": "Cmd",
            "control": "Ctrl",
            "ctrl": "Ctrl",
            "option": "Alt",
            "opt": "Alt",
            "alt": "Alt",
            "shift": "Shift",
            "win": "Cmd",
            "windows": "Cmd",
            "meta": "Cmd",
        }
        
        parts = shortcut_str.split("+")
        normalized_parts = []
        for part in parts:
            part_lower = part.lower()
            if part_lower in replacements:
                normalized_parts.append(replacements[part_lower])
            else:
                normalized_parts.append(part.upper())
        
        # 对修饰键排序以确保一致性
        modifiers = []
        key_part = ""
        for part in normalized_parts:
            if part in ["Cmd", "Ctrl", "Alt", "Shift"]:
                modifiers.append(part)
            else:
                key_part = part
        
        # 修饰键排序
        modifier_order = ["Cmd", "Ctrl", "Alt", "Shift"]
        sorted_modifiers = sorted(modifiers, key=lambda x: modifier_order.index(x) if x in modifier_order else 99)
        
        if sorted_modifiers and key_part:
            return "+".join(sorted_modifiers + [key_part])
        elif key_part:
            return key_part
        
        return shortcut_str
