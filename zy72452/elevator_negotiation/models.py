from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple
from datetime import datetime
from enum import Enum


class PointStatus(str, Enum):
    IMPORTED = "已导入"
    BOUNDARY_PENDING = "边界待复核"
    NOTICE_SUPPLEMENTED = "已补录施工告示"
    MANAGER_REVIEWED = "项目经理已复核"
    NORMAL = "正常流程"
    COMPLETED = "已完成"


class NextAction(str, Enum):
    FIND_MANAGER = "找项目经理复核"
    FIND_PLANNER = "找街道规划员小姜补录"
    FIND_COMMUNITY = "找居委会协商"
    WAITING = "待跟进"


@dataclass
class Street:
    name: str
    code: str
    boundary_polygon: List[Tuple[float, float]]


@dataclass
class ConstructionNotice:
    notice_id: str
    point_id: str
    construction_unit: str
    notice_date: str
    content: str
    attachment_urls: List[str] = field(default_factory=list)


@dataclass
class InspectionRecord:
    record_id: str
    point_id: str
    inspector: str
    inspection_date: str
    community_name: str
    building_number: str
    unit_count: int
    resident_count: int
    support_rate: float
    issues: List[str] = field(default_factory=list)


@dataclass
class NegotiationPoint:
    point_id: str
    name: str
    address: str
    lng: float
    lat: float
    status: PointStatus = PointStatus.IMPORTED
    located_streets: List[str] = field(default_factory=list)
    is_boundary: bool = False
    inspection: Optional[InspectionRecord] = None
    notice: Optional[ConstructionNotice] = None
    missing_materials: List[str] = field(default_factory=list)
    next_action: NextAction = NextAction.WAITING
    review_notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    history: List[Dict] = field(default_factory=list)

    def add_history(self, action: str, operator: str, note: str = ""):
        self.history.append({
            "time": datetime.now().isoformat(),
            "action": action,
            "operator": operator,
            "note": note
        })
        self.updated_at = datetime.now().isoformat()
