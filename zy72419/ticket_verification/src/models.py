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


STATUS_MAPPING = {
    "已核销": "已完成",
    "已完成": "已完成",
    "待核销": "未开始",
    "未开始": "未开始",
    "已使用": "已完成",
    "已取消": "已取消",
    "请假": "请假",
}

TICKET_STATUS_TO_AUDIO = {
    "已核销": "已完成",
    "待核销": "未开始",
    "已使用": "已完成",
    "已取消": "已取消",
}

AUDIO_STATUS_TO_TICKET = {
    "已完成": "已核销",
    "未开始": "待核销",
    "已取消": "已取消",
    "请假": "请假",
}


def normalize_status(raw_status: str) -> str:
    s = raw_status.strip()
    return STATUS_MAPPING.get(s, s)


def are_statuses_equivalent(ticket_status: str, audio_status: str) -> bool:
    tn = normalize_status(ticket_status)
    an = normalize_status(audio_status)
    return tn == an


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
    normalized_status: str = ""
    mapped_status: str = ""

    def __post_init__(self):
        if self.status and not self.normalized_status:
            self.normalized_status = normalize_status(self.status)
        if self.status and not self.mapped_status:
            self.mapped_status = TICKET_STATUS_TO_AUDIO.get(self.status, self.status)

    def add_history(self, action: str, operator: str, details: str = "",
                    before_value: Any = None, after_value: Any = None,
                    affected_field: str = ""):
        self.history.append(HistoryRecord(
            action=action,
            operator=operator,
            details=details,
            before_value=before_value,
            after_value=after_value,
            affected_field=affected_field,
            affected_ticket_id=self.ticket_id,
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
    current_verdict: str = "待负责人判断"
    handler_status: str = "可处理（确认/驳回）"
    normalized_ticket_status: str = ""
    normalized_audio_status: str = ""


@dataclass
class HistoryRecord:
    action: str
    operator: str
    details: str = ""
    before_value: Any = None
    after_value: Any = None
    affected_field: str = ""
    affected_ticket_id: str = ""
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class AuditTrail:
    entries: List[HistoryRecord] = field(default_factory=list)

    def add_entry(
        self,
        action: str,
        operator: str,
        details: str = "",
        before_value: Any = None,
        after_value: Any = None,
        affected_field: str = "",
        affected_ticket_id: str = ""
    ) -> HistoryRecord:
        entry = HistoryRecord(
            action=action,
            operator=operator,
            details=details,
            before_value=before_value,
            after_value=after_value,
            affected_field=affected_field,
            affected_ticket_id=affected_ticket_id,
            timestamp=datetime.now()
        )
        self.entries.append(entry)
        return entry

    def query_by_ticket(self, ticket_id: str) -> List[HistoryRecord]:
        return [e for e in self.entries if e.affected_ticket_id == ticket_id]

    def query_by_action(self, action: str) -> List[HistoryRecord]:
        return [e for e in self.entries if e.action == action]

    def query_by_operator(self, operator: str) -> List[HistoryRecord]:
        return [e for e in self.entries if e.operator == operator]

    def get_changes_for_ticket(self, ticket_id: str) -> List[Dict]:
        changes = []
        for e in self.query_by_ticket(ticket_id):
            changes.append({
                "action": e.action,
                "operator": e.operator,
                "details": e.details,
                "affected_field": e.affected_field,
                "before": e.before_value,
                "after": e.after_value,
                "timestamp": e.timestamp.isoformat()
            })
        return changes


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
    status_mapping_log: List[Dict[str, Any]] = field(default_factory=list)
    audit_entries: List[Dict[str, Any]] = field(default_factory=list)


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
