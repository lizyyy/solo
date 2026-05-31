from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from .base import VersionInfo


@dataclass
class TerrainEffect:
    """地形效果"""
    effect_id: str
    effect_name: str
    target_attr: str  # 影响的属性
    modifier: float  # 修正值
    condition: str = ""  # 触发条件

    def describe(self) -> str:
        return f"{self.effect_name}：使{self.target_attr}修正{self.modifier}"


@dataclass
class TerrainRule:
    """单条地形规则"""
    rule_id: str
    terrain_name: str
    terrain_type: str
    effects: List[TerrainEffect] = field(default_factory=list)
    description: str = ""


@dataclass
class TerrainRules:
    """地形规则集合"""
    rules_id: str
    version: VersionInfo
    rules: Dict[str, TerrainRule] = field(default_factory=dict)
    raw_content: str = ""

    def get_rule(self, rule_id: str) -> Optional[TerrainRule]:
        return self.rules.get(rule_id)

    def get_terrain_display_name(self, terrain_id: str) -> str:
        rule = self.rules.get(terrain_id)
        return rule.terrain_name if rule else f"未知地形({terrain_id})"
