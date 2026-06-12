from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class DirectionStatus(str, Enum):
    NORMAL = "正常"
    NEEDS_REVIEW = "待复核"
    ABNORMAL = "异常"
    FIELD_DISPUTE = "现场表述争议"


class NextHandler(str, Enum):
    EXPERIMENT_TEACHER = "实验老师"
    QA_XIAOBAI = "质检员小白"
    FIELD_MASTER = "现场师傅"


class AbnormalStatus(str, Enum):
    PENDING = "待处理"
    NEEDS_MORE_INFO = "缺材料"
    READY_FOR_REVIEW = "待复核"
    CONFIRMED_NORMAL = "已确认正常"
    RESOLVED = "已解决"
    DISPUTED = "有争议"


@dataclass
class RepairGroupScreenshot:
    id: str
    batch_id: str
    filename: str
    upload_time: datetime
    uploader: str
    content: Dict[str, Any]
    raw_text: str = ""


@dataclass
class SamplingIntervalNote:
    id: str
    batch_id: str
    filename: Optional[str]
    upload_time: datetime
    uploader: str
    content: Dict[str, Any]
    raw_text: str = ""


@dataclass
class AbnormalRecord:
    id: str
    batch_id: str
    point_id: str
    point_name: str
    status: AbnormalStatus
    direction_status: DirectionStatus
    keep_reason: str
    missing_materials: List[str]
    next_handler: NextHandler
    evidence_sources: List[str]
    created_at: datetime
    updated_at: datetime
    notes: str = ""
    field_mention: str = ""
    direction_field_text: str = ""
    is_field_dispute: bool = False
    trigger_source: str = ""
    resolution_trace: List[Dict[str, str]] = field(default_factory=list)


@dataclass
class AuditLog:
    id: str
    batch_id: str
    timestamp: datetime
    operator: str
    action: str
    field_changed: str
    old_value: str
    new_value: str
    reason: str
    affected_results: List[str]


@dataclass
class InspectionBatch:
    id: str
    name: str
    created_at: datetime
    status: str
    repair_screenshots: List[RepairGroupScreenshot] = field(default_factory=list)
    sampling_notes: List[SamplingIntervalNote] = field(default_factory=list)
    abnormal_records: List[AbnormalRecord] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    run_count: int = 0
