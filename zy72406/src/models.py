from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid
import json


class SongStatus(str, Enum):
    PENDING_IMPORT = "pending_import"
    IMPORTED = "imported"
    NAME_CONFLICT = "name_conflict"
    AWAITING_CONTRACT = "awaiting_contract"
    CONTRACT_VERIFIED = "contract_verified"
    TEACHER_REVIEW = "teacher_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ROLLED_BACK = "rolled_back"


class EvidenceType(str, Enum):
    GROUP_CHAT = "group_chat"
    CONTRACT_SCREENSHOT = "contract_screenshot"
    MANUAL_NOTE = "manual_note"


@dataclass
class Evidence:
    evidence_id: str
    evidence_type: EvidenceType
    source: str
    content: str
    recorded_at: datetime
    operator: str

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["recorded_at"] = self.recorded_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Evidence":
        d = d.copy()
        d["recorded_at"] = datetime.fromisoformat(d["recorded_at"])
        d["evidence_type"] = EvidenceType(d["evidence_type"])
        return cls(**d)


@dataclass
class ManualChange:
    change_id: str
    field_name: str
    old_value: str
    new_value: str
    changed_at: datetime
    operator: str
    reason: str

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["changed_at"] = self.changed_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ManualChange":
        d = d.copy()
        d["changed_at"] = datetime.fromisoformat(d["changed_at"])
        return cls(**d)


@dataclass
class SongRecord:
    record_id: str
    live_name: Optional[str]
    copyright_name: Optional[str]
    region: str
    status: SongStatus
    import_source: str
    original_row_number: Optional[int]
    import_time: datetime
    evidences: List[Evidence] = field(default_factory=list)
    manual_changes: List[ManualChange] = field(default_factory=list)
    status_history: List[tuple] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.status_history:
            self.status_history.append((self.status.value, datetime.now().isoformat(), "system"))

    def add_evidence(self, evidence_type: EvidenceType, source: str, content: str, operator: str) -> Evidence:
        evidence = Evidence(
            evidence_id=str(uuid.uuid4()),
            evidence_type=evidence_type,
            source=source,
            content=content,
            recorded_at=datetime.now(),
            operator=operator
        )
        self.evidences.append(evidence)
        return evidence

    def add_manual_change(self, field_name: str, old_value: str, new_value: str, operator: str, reason: str) -> ManualChange:
        change = ManualChange(
            change_id=str(uuid.uuid4()),
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_at=datetime.now(),
            operator=operator,
            reason=reason
        )
        self.manual_changes.append(change)
        return change

    def update_status(self, new_status: SongStatus, operator: str = "system"):
        self.status = new_status
        self.status_history.append((new_status.value, datetime.now().isoformat(), operator))

    def has_name_conflict(self) -> bool:
        return self.live_name and self.copyright_name and self.live_name != self.copyright_name

    def get_display_name(self) -> str:
        if self.copyright_name:
            return self.copyright_name
        return self.live_name or "未命名"

    def get_evidence_summary(self) -> Dict[str, Any]:
        group_chat_count = sum(1 for e in self.evidences if e.evidence_type == EvidenceType.GROUP_CHAT)
        contract_count = sum(1 for e in self.evidences if e.evidence_type == EvidenceType.CONTRACT_SCREENSHOT)
        return {
            "record_id": self.record_id,
            "display_name": self.get_display_name(),
            "live_name": self.live_name,
            "copyright_name": self.copyright_name,
            "region": self.region,
            "status": self.status.value,
            "original_row_number": self.original_row_number,
            "group_chat_evidence_count": group_chat_count,
            "contract_evidence_count": contract_count,
            "manual_change_count": len(self.manual_changes),
            "last_updated": self.status_history[-1][1] if self.status_history else None
        }

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        d["import_time"] = self.import_time.isoformat()
        d["evidences"] = [e.to_dict() for e in self.evidences]
        d["manual_changes"] = [c.to_dict() for c in self.manual_changes]
        d["status_history"] = [(s, t, o) for s, t, o in self.status_history]
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "SongRecord":
        d = d.copy()
        d["status"] = SongStatus(d["status"])
        d["import_time"] = datetime.fromisoformat(d["import_time"])
        d["evidences"] = [Evidence.from_dict(e) for e in d.get("evidences", [])]
        d["manual_changes"] = [ManualChange.from_dict(c) for c in d.get("manual_changes", [])]
        d["status_history"] = [(s, t, o) for s, t, o in d.get("status_history", [])]
        return cls(**d)


@dataclass
class CheckReport:
    report_id: str
    generated_at: datetime
    total_records: int
    status_breakdown: Dict[str, int]
    conflict_count: int
    awaiting_review_count: int
    records: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "generated_at": self.generated_at.isoformat(),
            "summary": {
                "total_records": self.total_records,
                "status_breakdown": self.status_breakdown,
                "conflict_count": self.conflict_count,
                "awaiting_review_count": self.awaiting_review_count
            },
            "records": self.records
        }
