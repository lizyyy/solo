"""数据模型定义"""
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class AnomalyLevel(str, Enum):
    NORMAL = "正常"
    WARNING = "预警"
    CRITICAL = "严重"
    BOUNDARY = "边界"


class BoundaryReason(str, Enum):
    FORMULA = "公式边界"
    UNIT = "单位偏差"
    THRESHOLD = "阈值容差"


class RecordStatus(str, Enum):
    NEW = "新采集"
    PROCESSED = "已处理(旧)"
    APPENDED = "后补备注"
    EXPORTED = "已导出(最新)"


@dataclass
class Measurement:
    timestamp: str
    turbine_id: str
    blade_no: int
    vibration_velocity: float
    vibration_unit: str = "mm/s"
    temperature: float = 0.0
    ambient_temp: float = 0.0
    temp_unit: str = "°C"
    pitch_angle: float = 0.0
    pitch_reference: float = 0.0
    pitch_unit: str = "°"
    source: str = "班组交接"


@dataclass
class SparePart:
    part_code: str
    part_name: str
    required_date: str
    arrival_date: str
    quantity: int = 1
    is_replacement: bool = False
    original_code: Optional[str] = None
    lead_time_days: int = 0

    @property
    def arrival_delay_days(self) -> int:
        req = datetime.strptime(self.required_date, "%Y-%m-%d")
        arr = datetime.strptime(self.arrival_date, "%Y-%m-%d")
        return (arr - req).days

    @property
    def is_late(self) -> bool:
        return self.arrival_delay_days > 0


@dataclass
class BoundaryDetail:
    is_boundary: bool = False
    reason: Optional[BoundaryReason] = None
    metric: str = ""
    raw_value: float = 0.0
    threshold_value: float = 0.0
    tolerance: float = 0.0
    unit: str = ""
    formula: str = ""
    description: str = ""


@dataclass
class EvidenceItem:
    step_order: int
    step_name: str
    source_data: Dict[str, Any]
    calculation: str
    intermediate_result: str
    timestamp: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))


@dataclass
class VersionMeta:
    record_id: str
    run_id: str
    status: RecordStatus
    previous_run_id: Optional[str] = None
    appended_note: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    exported: bool = False


@dataclass
class AttributionRecord:
    record_id: str
    measurement: Measurement
    level: AnomalyLevel = AnomalyLevel.NORMAL
    root_cause: str = ""
    conclusion: str = ""
    boundary_detail: BoundaryDetail = field(default_factory=BoundaryDetail)
    spare_parts: List[SparePart] = field(default_factory=list)
    evidence_chain: List[EvidenceItem] = field(default_factory=list)
    handover_notes: str = ""
    final_verdict_source: str = "未确认"
    version: VersionMeta = field(default_factory=lambda: VersionMeta(
        record_id="", run_id="", status=RecordStatus.NEW
    ))

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["level"] = self.level.value
        d["status"] = self.version.status.value
        if self.boundary_detail.reason:
            d["boundary_reason"] = self.boundary_detail.reason.value
        return d
