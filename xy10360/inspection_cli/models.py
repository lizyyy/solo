"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional


class InspectionStatus(Enum):
    NORMAL = "正常"
    ABNORMAL = "异常"
    MISSING = "漏检"
    SUPPLEMENTARY = "补录"
    COMPLETED = "已完成"
    PENDING = "待巡检"


class SourceType(Enum):
    SCAN = "扫码"
    SUPPLEMENTARY = "补录"


@dataclass
class DevicePoint:
    route_id: str
    route_name: str
    point_id: str
    point_name: str
    point_order: int
    required: bool = True
    shift_start: Optional[datetime] = None
    shift_end: Optional[datetime] = None
    inspector: Optional[str] = None


@dataclass
class ScanRecord:
    record_id: str
    point_id: str
    scan_time: datetime
    status: InspectionStatus
    remark: Optional[str] = None
    inspector: Optional[str] = None
    source: SourceType = SourceType.SCAN
    is_merged: bool = False
    original_records: List[str] = field(default_factory=list)


@dataclass
class SupplementaryRecord:
    record_id: str
    point_id: str
    supplementary_time: datetime
    status: InspectionStatus
    remark: Optional[str] = None
    inspector: Optional[str] = None
    source: SourceType = SourceType.SUPPLEMENTARY


@dataclass
class InspectionResult:
    route_id: str
    route_name: str
    total_points: int
    completed_points: int
    missing_points: List[str]
    abnormal_points: List[str]
    need_review: List[str]
    status: str
    shift_start: Optional[datetime] = None
    shift_end: Optional[datetime] = None
    inspector: Optional[str] = None


@dataclass
class ValidationError:
    error_type: str
    point_id: str
    point_name: str
    route_id: str
    message: str
    record_id: Optional[str] = None
    scan_time: Optional[datetime] = None
