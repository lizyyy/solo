from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class RecordStatus(str, Enum):
    PENDING = "pending"
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    REVIEW_REQUIRED = "review_required"
    REVIEW_APPROVED = "review_approved"
    REVIEW_REJECTED = "review_rejected"
    ROLLED_BACK = "rolled_back"


class AbnormalType(str, Enum):
    LEAVE_COUNTED_AS_CONSUMED = "leave_counted_as_consumed"
    MISMATCH_BETWEEN_SOURCES = "mismatch_between_sources"
    MANUAL_CORRECTION = "manual_correction"


class ProcessStep(str, Enum):
    STEP1_IMPORT = "step1_import_engineer_message"
    STEP2_CHECK_GROUP = "step2_check_group_signup"
    STEP3_UPDATE_TRACKLIST = "step3_update_tracklist"


@dataclass
class AuditLog:
    timestamp: datetime
    step: ProcessStep
    operator: str
    action: str
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    note: Optional[str] = None


@dataclass
class SourceLine:
    source_name: str
    line_number: int
    raw_content: str
    parsed_data: Dict[str, Any]


@dataclass
class ScheduleRecord:
    id: str
    episode_number: str
    track_name: str
    scheduled_date: str
    scheduled_time: str
    duration_minutes: int
    engineer_name: str
    status: RecordStatus = RecordStatus.PENDING
    abnormal_type: Optional[AbnormalType] = None
    abnormal_note: Optional[str] = None
    reviewer: Optional[str] = None
    review_time: Optional[datetime] = None
    consumed: bool = False
    is_leave: bool = False
    sources: List[SourceLine] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    current_step: ProcessStep = ProcessStep.STEP1_IMPORT
    manual_edits: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["sources"] = [asdict(s) for s in self.sources]
        d["audit_logs"] = []
        for a in self.audit_logs:
            al = asdict(a)
            al["timestamp"] = a.timestamp.isoformat() if a.timestamp else None
            d["audit_logs"].append(al)
        d["review_time"] = self.review_time.isoformat() if self.review_time else None
        return d
