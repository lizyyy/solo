"""数据模型模块"""

from src.models.application import Application
from src.models.context import Context
from src.models.shortcut import Shortcut, ShortcutKey, ModifierKey
from src.models.conflict import (
    Conflict,
    ConflictType,
    ConflictSeverity,
    PlatformDifference,
    UnreachableShortcut,
    DuplicateMacro,
)

__all__ = [
    "Application",
    "Context",
    "Shortcut",
    "ShortcutKey",
    "ModifierKey",
    "Conflict",
    "ConflictType",
    "ConflictSeverity",
    "PlatformDifference",
    "UnreachableShortcut",
    "DuplicateMacro",
]
