from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from .base import VersionInfo


@dataclass
class SettlementItem:
    """单项结算数据"""
    item_id: str
    item_name: str
    unit_id: str
    value: Any
    expected_value: Optional[Any] = None
    calculation_details: Dict[str, Any] = field(default_factory=dict)

    def describe(self) -> str:
        return f"{self.item_name}：{self.value}"


@dataclass
class BattleSettlement:
    """战斗结算"""
    settlement_id: str
    version: VersionInfo
    match_name: str
    final_score: Dict[str, int] = field(default_factory=dict)  # 队伍 -> 分数
    mvp_unit_id: Optional[str] = None
    items: List[SettlementItem] = field(default_factory=list)
    raw_content: str = ""
    calculation_log: str = ""

    def get_item(self, item_id: str) -> Optional[SettlementItem]:
        for item in self.items:
            if item.item_id == item_id:
                return item
        return None
