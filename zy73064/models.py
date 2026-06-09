from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime


class AttributionStatus(str, Enum):
    PENDING_CONFIRM = "待确认"
    CONFIRMED = "已确认"
    PENDING_PART = "待补件"
    RETURNED = "退回"
    NORMAL = "正常"


class AlarmStatus(str, Enum):
    OPEN = "未处理"
    PROCESSING = "处理中"
    CLOSED = "已关闭"


class PartStatus(str, Enum):
    NORMAL = "正常"
    ABNORMAL = "异常"
    REPLACED = "型号替换"
    MISSING = "缺失"


class NoteSource(str, Enum):
    MANUAL = "人工"
    SYSTEM = "系统"


@dataclass
class SparePart:
    id: Optional[int] = None
    part_no: str = ""
    part_name: str = ""
    part_model: str = ""
    expected_model: str = ""
    quantity: int = 0
    pipeline_id: str = ""
    status: PartStatus = PartStatus.NORMAL
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class Alarm:
    id: Optional[int] = None
    alarm_no: str = ""
    pipeline_id: str = ""
    alarm_type: str = ""
    alarm_desc: str = ""
    status: AlarmStatus = AlarmStatus.OPEN
    trigger_time: datetime = field(default_factory=datetime.now)
    resolved_time: Optional[datetime] = None
    related_part_no: Optional[str] = None


@dataclass
class ManualNote:
    id: Optional[int] = None
    note_no: str = ""
    pipeline_id: str = ""
    related_alarm_no: Optional[str] = None
    related_part_no: Optional[str] = None
    source: NoteSource = NoteSource.MANUAL
    operator: str = ""
    content: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class AnomalyAttribution:
    id: Optional[int] = None
    attr_no: str = ""
    pipeline_id: str = ""
    part_id: Optional[int] = None
    alarm_id: Optional[int] = None
    note_id: Optional[int] = None
    status: AttributionStatus = AttributionStatus.PENDING_CONFIRM
    attribution_reason: str = ""
    pending_reason: str = ""
    affected_records: str = ""
    operator: str = ""
    is_model_replace: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class AttributionDetail:
    attr_no: str = ""
    pipeline_id: str = ""
    status: AttributionStatus = AttributionStatus.PENDING_CONFIRM
    status_for_export: str = ""
    attribution_reason: str = ""
    pending_reason: str = ""
    affected_records: str = ""
    part_no: str = ""
    part_name: str = ""
    part_model: str = ""
    expected_model: str = ""
    part_status: str = ""
    alarm_no: str = ""
    alarm_type: str = ""
    alarm_desc: str = ""
    alarm_status: str = ""
    note_no: str = ""
    note_content: str = ""
    note_operator: str = ""
    operator: str = ""
    created_at: str = ""


STATUS_EXPORT_MAPPING = {
    AttributionStatus.PENDING_CONFIRM: "待确认",
    AttributionStatus.CONFIRMED: "已确认",
    AttributionStatus.PENDING_PART: "待补件",
    AttributionStatus.RETURNED: "退回",
    AttributionStatus.NORMAL: "正常",
}
