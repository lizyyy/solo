from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum
import uuid


class TicketStatus(Enum):
    PENDING = "待核对"
    CONFIRMED = "已确认"
    REJECTED = "已驳回"
    NEED_REVIEW = "待巡演统筹复核"
    CONFLICT = "存在冲突"


class LeaveStatus(Enum):
    NORMAL = "正常"
    LEAVE = "请假"
    MAKEUP = "补录"


class ConflictType(Enum):
    REPERTOIRE_MISMATCH = "曲目不符"
    STATUS_MISMATCH = "状态不符"
    DATE_MISMATCH = "日期不符"
    DUPLICATE = "重复记录"
    LEAVE_COUNTED = "请假课时被算进已消耗"
    OTHER = "其他"


@dataclass
class TicketRecord:
    ticket_id: str
    student_name: str
    repertoire: str
    performance_date: str
    status: str
    is_consumed: bool = False
    leave_status: LeaveStatus = LeaveStatus.NORMAL
    source: str = "票务导出表"
    import_batch: str = ""
    import_time: datetime = field(default_factory=datetime.now)
    raw_data: Dict[str, Any] = field(default_factory=dict)
    audio_remarks: Optional[str] = None
    conflicts: List["Conflict"] = field(default_factory=list)
    verification_status: TicketStatus = TicketStatus.PENDING
    review_notes: str = ""
    history: List["HistoryRecord"] = field(default_factory=list)

    def add_history(self, action: str, operator: str, details: str = ""):
        self.history.append(HistoryRecord(
            action=action,
            operator=operator,
            details=details,
            timestamp=datetime.now()
        ))


@dataclass
class AudioRemark:
    audio_file: str
    ticket_id: str
    student_name: str
    raw_remark: str
    parsed_repertoire: Optional[str] = None
    parsed_date: Optional[str] = None
    parsed_status: Optional[str] = None
    parsed_is_leave: bool = False
    parsed_extra: Dict[str, Any] = field(default_factory=dict)
    parse_time: datetime = field(default_factory=datetime.now)


@dataclass
class Conflict:
    conflict_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    conflict_type: ConflictType = ConflictType.OTHER
    ticket_id: str = ""
    field_name: str = ""
    ticket_value: Any = None
    audio_value: Any = None
    description: str = ""
    evidence: Dict[str, Any] = field(default_factory=dict)
    resolved: bool = False
    resolution: str = ""
    resolved_by: str = ""
    resolved_time: Optional[datetime] = None


@dataclass
class HistoryRecord:
    action: str
    operator: str
    details: str = ""
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class RepertoireChecklist:
    checklist_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    performance_date: str = ""
    items: List["ChecklistItem"] = field(default_factory=list)
    created_time: datetime = field(default_factory=datetime.now)
    updated_time: datetime = field(default_factory=datetime.now)


@dataclass
class ChecklistItem:
    ticket_id: str
    student_name: str
    repertoire: str
    is_checked: bool = False
    checked_by: str = ""
    checked_time: Optional[datetime] = None
    remarks: str = ""


@dataclass
class VerificationReport:
    report_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    generated_time: datetime = field(default_factory=datetime.now)
    total_tickets: int = 0
    confirmed_count: int = 0
    rejected_count: int = 0
    conflict_count: int = 0
    need_review_count: int = 0
    leave_counted_count: int = 0
    conflicts: List[Conflict] = field(default_factory=list)
    checklist_summary: Dict[str, Any] = field(default_factory=dict)
    self_check_results: List["SelfCheckResult"] = field(default_factory=list)


@dataclass
class SelfCheckResult:
    check_name: str
    passed: bool
    details: str = ""
    issues: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ImportBatch:
    batch_id: str
    file_name: str
    import_time: datetime = field(default_factory=datetime.now)
    record_count: int = 0
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
