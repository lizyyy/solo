"""冲突和问题模型"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime


class ConflictType(Enum):
    """冲突类型枚举"""
    # 快捷键冲突
    SAME_KEY_CONFLICT = "same_key_conflict"  # 同一组合键被多个快捷键使用
    OVERLAPPING_SHORTCUT = "overlapping_shortcut"  # 重叠的快捷键
    
    # 平台相关
    PLATFORM_DIFFERENCE = "platform_difference"  # 平台差异
    MAC_WINDOWS_INCOMPATIBLE = "mac_windows_incompatible"  # Mac/Windows不兼容
    
    # 系统问题
    SYSTEM_RESERVED = "system_reserved"  # 系统保留键
    UNREACHABLE = "unreachable"  # 不可达组合键
    INVALID_KEY = "invalid_key"  # 无效键
    
    # 宏相关
    DUPLICATE_MACRO = "duplicate_macro"  # 重复宏
    CONFLICTING_MACRO = "conflicting_macro"  # 冲突宏
    
    # 用户标记
    USER_RESERVED = "user_reserved"  # 用户标记为保留
    USER_MODIFIED = "user_modified"  # 用户已修改


class ConflictSeverity(Enum):
    """冲突严重程度枚举"""
    CRITICAL = "critical"  # 严重 - 必须修复
    HIGH = "high"  # 高 - 建议修复
    MEDIUM = "medium"  # 中 - 可选修复
    LOW = "low"  # 低 - 信息提示
    INFO = "info"  # 仅信息


@dataclass
class Conflict:
    """冲突模型 - 表示检测到的问题"""
    
    # 基本信息
    id: str = ""
    conflict_type: str = ""
    severity: str = ""
    description: str = ""
    
    # 涉及的快捷键
    involved_shortcut_ids: List[str] = field(default_factory=list)
    involved_application_ids: List[str] = field(default_factory=list)
    
    # 冲突的键组合
    conflicting_key: str = ""  # 冲突的快捷键字符串
    
    # 检测信息
    detected_time: Optional[float] = None
    rule_name: str = ""
    
    # 解决信息
    is_resolved: bool = False
    resolution_notes: str = ""
    resolved_time: Optional[float] = None
    
    # 用户标记
    user_notes: str = ""
    is_ignored: bool = False
    
    def __post_init__(self):
        if not self.id:
            import hashlib
            import time
            content = f"{self.conflict_type}:{self.conflicting_key}:{time.time()}"
            self.id = hashlib.md5(content.encode()).hexdigest()[:12]
        if not self.detected_time:
            self.detected_time = time.time()
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "conflict_type": self.conflict_type,
            "severity": self.severity,
            "description": self.description,
            "involved_shortcut_ids": self.involved_shortcut_ids,
            "involved_application_ids": self.involved_application_ids,
            "conflicting_key": self.conflicting_key,
            "detected_time": self.detected_time,
            "rule_name": self.rule_name,
            "is_resolved": self.is_resolved,
            "resolution_notes": self.resolution_notes,
            "resolved_time": self.resolved_time,
            "user_notes": self.user_notes,
            "is_ignored": self.is_ignored,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Conflict":
        """从字典创建"""
        conflict = cls()
        conflict.id = data.get("id", "")
        conflict.conflict_type = data.get("conflict_type", "")
        conflict.severity = data.get("severity", "")
        conflict.description = data.get("description", "")
        conflict.involved_shortcut_ids = data.get("involved_shortcut_ids", [])
        conflict.involved_application_ids = data.get("involved_application_ids", [])
        conflict.conflicting_key = data.get("conflicting_key", "")
        conflict.detected_time = data.get("detected_time")
        conflict.rule_name = data.get("rule_name", "")
        conflict.is_resolved = data.get("is_resolved", False)
        conflict.resolution_notes = data.get("resolution_notes", "")
        conflict.resolved_time = data.get("resolved_time")
        conflict.user_notes = data.get("user_notes", "")
        conflict.is_ignored = data.get("is_ignored", False)
        
        return conflict


@dataclass
class PlatformDifference:
    """平台差异模型"""
    
    id: str = ""
    shortcut_id: str = ""
    application_id: str = ""
    
    # 平台特定的快捷键
    mac_key: str = ""
    windows_key: str = ""
    linux_key: str = ""
    
    # 差异类型
    difference_type: str = ""  # "modifier_difference", "key_difference", "missing"
    
    # 问题描述
    description: str = ""
    severity: str = "medium"
    suggestion: str = ""
    
    # 解决状态
    is_resolved: bool = False
    user_notes: str = ""
    
    def __post_init__(self):
        if not self.id:
            import hashlib
            import time
            content = f"{self.shortcut_id}:{self.application_id}:{time.time()}"
            self.id = hashlib.md5(content.encode()).hexdigest()[:12]
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "shortcut_id": self.shortcut_id,
            "application_id": self.application_id,
            "mac_key": self.mac_key,
            "windows_key": self.windows_key,
            "linux_key": self.linux_key,
            "difference_type": self.difference_type,
            "description": self.description,
            "severity": self.severity,
            "suggestion": self.suggestion,
            "is_resolved": self.is_resolved,
            "user_notes": self.user_notes,
        }


@dataclass
class UnreachableShortcut:
    """不可达快捷键模型"""
    
    id: str = ""
    shortcut_id: str = ""
    application_id: str = ""
    
    # 问题信息
    key_string: str = ""
    reason: str = ""  # "too_many_modifiers", "invalid_combination", "physically_impossible"
    description: str = ""
    
    # 详细信息
    modifiers: List[str] = field(default_factory=list)
    key: str = ""
    
    # 严重程度和建议
    severity: str = "high"
    suggestion: str = ""
    
    # 解决状态
    is_resolved: bool = False
    user_notes: str = ""
    
    def __post_init__(self):
        if not self.id:
            import hashlib
            import time
            content = f"{self.shortcut_id}:{self.key_string}:{time.time()}"
            self.id = hashlib.md5(content.encode()).hexdigest()[:12]
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "shortcut_id": self.shortcut_id,
            "application_id": self.application_id,
            "key_string": self.key_string,
            "reason": self.reason,
            "description": self.description,
            "modifiers": self.modifiers,
            "key": self.key,
            "severity": self.severity,
            "suggestion": self.suggestion,
            "is_resolved": self.is_resolved,
            "user_notes": self.user_notes,
        }


@dataclass
class DuplicateMacro:
    """重复宏模型"""
    
    id: str = ""
    macro_name: str = ""
    
    # 涉及的快捷键
    shortcut_ids: List[str] = field(default_factory=list)
    application_ids: List[str] = field(default_factory=list)
    
    # 宏定义
    macro_commands: List[str] = field(default_factory=list)
    
    # 问题信息
    description: str = ""
    severity: str = "medium"
    
    # 差异检测
    has_different_bindings: bool = False
    different_keys: List[str] = field(default_factory=list)
    
    # 解决状态
    is_resolved: bool = False
    user_notes: str = ""
    
    def __post_init__(self):
        if not self.id:
            import hashlib
            import time
            content = f"{self.macro_name}:{len(self.shortcut_ids)}:{time.time()}"
            self.id = hashlib.md5(content.encode()).hexdigest()[:12]
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "macro_name": self.macro_name,
            "shortcut_ids": self.shortcut_ids,
            "application_ids": self.application_ids,
            "macro_commands": self.macro_commands,
            "description": self.description,
            "severity": self.severity,
            "has_different_bindings": self.has_different_bindings,
            "different_keys": self.different_keys,
            "is_resolved": self.is_resolved,
            "user_notes": self.user_notes,
        }
