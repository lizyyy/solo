from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class AlertLevel(Enum):
    NORMAL = "正常"
    NOTICE = "注意"
    WARNING = "警告"
    ALARM = "报警"
    CRITICAL = "严重"


class RecordSource(Enum):
    AUTO = "自动采集"
    MANUAL = "人工录入"
    CORRECTED = "人工更正"
    ATTACHMENT = "附件导入"


class RecordStatus(Enum):
    NORMAL = "正常"
    PENDING = "待确认"
    DUPLICATE = "重复项"
    LATE_ARRIVAL = "晚到数据"
    SEQUENCE_ERROR = "时序错误"
    THRESHOLD_CROSS = "阈值跨档"


class ProcessingStatus(Enum):
    PENDING = "待处理"
    PROCESSED = "已处理"
    NEEDS_REVIEW = "需复核"


@dataclass
class ThresholdConfig:
    metric_name: str
    level: AlertLevel
    min_value: float
    max_value: float
    unit: str
    description: str


@dataclass
class InspectionRecord:
    record_id: str
    device_id: str
    device_name: str
    metric_name: str
    metric_value: float
    unit: str
    collect_time: datetime
    receive_time: datetime
    source: RecordSource
    operator: Optional[str] = None
    attachment_name: Optional[str] = None
    original_record_id: Optional[str] = None
    remarks: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuditTrail:
    trail_id: str
    record_id: str
    action: str
    old_level: Optional[AlertLevel]
    new_level: Optional[AlertLevel]
    reason: str
    evidence: Dict[str, Any]
    operator: Optional[str]
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ProcessingResult:
    record: InspectionRecord
    status: RecordStatus
    level: AlertLevel
    audit_trails: List[AuditTrail] = field(default_factory=list)
    error_message: Optional[str] = None
    user_friendly_message: Optional[str] = None
    suggestions: List[str] = field(default_factory=list)
    is_pending_review: bool = False
    review_reason: Optional[str] = None


@dataclass
class DuplicateGroup:
    group_key: str
    records: List[InspectionRecord]
    kept_record_id: Optional[str] = None
    duplicate_count: int = 0


@dataclass
class InspectionReport:
    report_id: str
    generate_time: datetime
    total_records: int
    normal_count: int
    pending_count: int
    warning_count: int
    alarm_count: int
    critical_count: int
    normal_results: List[ProcessingResult]
    pending_results: List[ProcessingResult]
    threshold_cross_count: int
    duplicate_count: int
    late_arrival_count: int
    sequence_error_count: int
    summary: str
