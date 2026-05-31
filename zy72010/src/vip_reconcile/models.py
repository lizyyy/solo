from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class MatchStatus(str, Enum):
    CONFIRMED = "已确认"
    PENDING_MATERIALS = "待补材料"
    MANUAL_REVIEW = "人工改判"
    CONFLICT = "数据冲突"
    UNMATCHED = "未匹配"


class EvidenceType(str, Enum):
    PAYMENT_RECEIPT = "收款流水"
    REFUND_REQUEST = "退款申请"
    APPROVAL_EMAIL = "审批邮件"
    BANK_RECEIPT = "银企回单截图"
    MANUAL_NOTE = "手写备注"
    ATTACHMENT = "附件"


@dataclass
class EvidenceRecord:
    evidence_type: EvidenceType
    source_file: str
    content: str
    recorded_at: datetime = field(default_factory=datetime.now)
    amount: Optional[float] = None
    voucher_no: Optional[str] = None
    passenger_name: Optional[str] = None
    flight_no: Optional[str] = None
    service_date: Optional[str] = None


@dataclass
class JudgmentHistory:
    timestamp: datetime
    status_before: MatchStatus
    status_after: MatchStatus
    reason: str
    operator: str
    evidence_refs: List[str] = field(default_factory=list)
    note: Optional[str] = None


@dataclass
class ReconciliationRecord:
    voucher_no: str
    passenger_name: str
    service_date: str
    flight_no: str
    expected_amount: float
    actual_amount: Optional[float] = None
    current_status: MatchStatus = MatchStatus.UNMATCHED
    evidence: List[EvidenceRecord] = field(default_factory=list)
    judgment_history: List[JudgmentHistory] = field(default_factory=list)
    manual_notes: List[str] = field(default_factory=list)
    conflict_details: Optional[Dict[str, Any]] = None
    suggestions: List[str] = field(default_factory=list)

    @property
    def amount_diff(self) -> Optional[float]:
        if self.actual_amount is not None:
            return self.actual_amount - self.expected_amount
        return None

    def add_evidence(self, evidence: EvidenceRecord) -> None:
        self.evidence.append(evidence)

    def add_judgment(self, judgment: JudgmentHistory) -> None:
        self.judgment_history.append(judgment)
        self.current_status = judgment.status_after

    def add_manual_note(self, note: str, operator: str = "系统补录") -> None:
        timestamp = datetime.now()
        self.manual_notes.append(f"[{timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {operator}: {note}")

    def has_evidence_type(self, evidence_type: EvidenceType) -> bool:
        return any(e.evidence_type == evidence_type for e in self.evidence)

    def get_evidence_by_type(self, evidence_type: EvidenceType) -> List[EvidenceRecord]:
        return [e for e in self.evidence if e.evidence_type == evidence_type]
