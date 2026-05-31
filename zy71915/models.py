from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict
import uuid


class ConfirmationStatus(str, Enum):
    CONFIRMED = "已确认"
    PENDING = "待确认"
    REJECTED = "已撤回"
    NEEDS_REVIEW = "需复核"


class IssueType(str, Enum):
    MISSING_MATERIAL = "缺少素材"
    TIMELINE_DRIFT = "时间轴漂移"
    SILENCE_DELETED = "静音段误删"
    OVERLAP = "时段重叠"
    INVALID_DATA = "数据格式错误"


@dataclass
class Material:
    material_id: str
    name: str
    duration: timedelta
    file_path: Optional[str] = None
    exists: bool = True


@dataclass
class SilenceSegment:
    start: timedelta
    end: timedelta
    preserved: bool = True


@dataclass
class Issue:
    issue_type: IssueType
    severity: str
    message: str
    details: Dict = field(default_factory=dict)
    reviewable_reason: Optional[str] = None


@dataclass
class ScheduleRecord:
    record_id: str
    version: int = 1
    ad_name: str = ""
    slot_start: datetime = None
    slot_end: datetime = None
    expected_duration: timedelta = None
    actual_duration: timedelta = None
    materials: List[Material] = field(default_factory=list)
    silence_segments: List[SilenceSegment] = field(default_factory=list)
    status: ConfirmationStatus = ConfirmationStatus.PENDING
    issues: List[Issue] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""
    notes: str = ""
    drift_threshold: timedelta = field(default_factory=lambda: timedelta(seconds=5))

    def calculate_drift(self) -> timedelta:
        if self.slot_start and self.slot_end and self.expected_duration:
            actual = self.slot_end - self.slot_start
            return actual - self.expected_duration
        return timedelta(0)


@dataclass
class OperationLog:
    log_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    operation: str = ""
    record_id: str = ""
    version: int = 0
    operator: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    details: Dict = field(default_factory=dict)


@dataclass
class ScheduleDatabase:
    records: Dict[str, ScheduleRecord] = field(default_factory=dict)
    logs: List[OperationLog] = field(default_factory=list)

    def add_log(self, operation: str, record_id: str, version: int, operator: str, details: Dict = None):
        log = OperationLog(
            operation=operation,
            record_id=record_id,
            version=version,
            operator=operator,
            details=details or {}
        )
        self.logs.append(log)
