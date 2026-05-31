from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from datetime import datetime
from .base import VersionInfo


@dataclass
class UnitAttribute:
    """单位属性"""
    name: str
    value: Any
    display_name: str = ""  # 人话名称，用于错误提示

    def __post_init__(self):
        if not self.display_name:
            self.display_name = self.name


@dataclass
class Unit:
    """单个单位"""
    unit_id: str
    unit_name: str
    unit_type: str  # 机器人/球员/建筑 等
    attributes: Dict[str, UnitAttribute] = field(default_factory=dict)
    skills: List[str] = field(default_factory=list)

    def get_attr(self, key: str, default: Any = None) -> Any:
        attr = self.attributes.get(key)
        return attr.value if attr else default

    def get_attr_display(self, key: str) -> str:
        attr = self.attributes.get(key)
        return attr.display_name if attr else key


@dataclass
class UnitTable:
    """单位表"""
    table_id: str
    version: VersionInfo
    units: Dict[str, Unit] = field(default_factory=dict)
    raw_content: str = ""

    def get_unit(self, unit_id: str) -> Optional[Unit]:
        return self.units.get(unit_id)

    def get_unit_display_name(self, unit_id: str) -> str:
        unit = self.units.get(unit_id)
        return unit.unit_name if unit else f"未知单位({unit_id})"
