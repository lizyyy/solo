from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class VehicleType(str, Enum):
    TYPE_1 = "1型客车"
    TYPE_2 = "2型客车"
    TYPE_3 = "3型客车"
    TYPE_4 = "4型客车"
    TYPE_5 = "1型货车"
    TYPE_6 = "2型货车"
    TYPE_7 = "3型货车"
    TYPE_8 = "4型货车"
    TYPE_9 = "5型货车"
    TYPE_10 = "6型货车"
    UNKNOWN = "未知"


class AuditStatus(str, Enum):
    PENDING = "待稽核"
    PASSED = "通过"
    SUSPICIOUS = "疑似异常"
    CONFIRMED = "确认异常"
    RESOLVED = "已处理"


@dataclass
class TollRecord:
    record_id: str
    plate_number: str
    entry_station: str
    exit_station: str
    entry_time: datetime
    exit_time: datetime
    vehicle_type: VehicleType
    weight: float
    toll_amount: float
    is_etc: bool
    status: AuditStatus = AuditStatus.PENDING
    issues: List[str] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def travel_duration(self) -> float:
        return (self.exit_time - self.entry_time).total_seconds() / 3600


@dataclass
class VehicleRule:
    rule_id: str
    rule_name: str
    description: str
    vehicle_type: VehicleType
    min_weight: Optional[float] = None
    max_weight: Optional[float] = None
    min_travel_time_ratio: Optional[float] = None
    max_travel_time_ratio: Optional[float] = None
    is_active: bool = True


@dataclass
class Route:
    route_id: str
    entry_station: str
    exit_station: str
    expected_distance: float
    min_expected_time: float
    max_expected_time: float
    valid: bool = True


@dataclass
class AuditResult:
    record_id: str
    plate_number: str
    vehicle_type: str
    vehicle_type_issue: bool = False
    vehicle_type_evidence: str = ""
    route_issue: bool = False
    route_evidence: str = ""
    final_status: AuditStatus = AuditStatus.PENDING
    needs_manual_review: bool = False
    review_notes: List[str] = field(default_factory=list)
