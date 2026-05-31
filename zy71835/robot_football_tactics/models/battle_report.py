from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from datetime import datetime
from .base import VersionInfo


@dataclass
class BattleEvent:
    """战报中的单个事件"""
    timestamp: float
    event_type: str  # 射门/传球/抢断/犯规 等
    actor_unit_id: str
    target_unit_id: Optional[str] = None
    terrain_id: Optional[str] = None
    result: str = ""  # 成功/失败/进球 等
    details: Dict[str, Any] = field(default_factory=dict)
    raw_text: str = ""


@dataclass
class BattleReport:
    """战报"""
    report_id: str
    version: VersionInfo
    match_name: str
    match_time: datetime
    events: List[BattleEvent] = field(default_factory=list)
    raw_content: str = ""
    manual_modified: bool = False  # 是否被手工改动过

    def get_events_by_type(self, event_type: str) -> List[BattleEvent]:
        return [e for e in self.events if e.event_type == event_type]
