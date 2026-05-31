from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class RecordType(Enum):
    PAYMENT = "payment"
    REFUND = "refund"
    APPROVAL = "approval"
    NOTE = "note"
    ATTACHMENT = "attachment"


class ConflictStatus(Enum):
    NONE = "none"
    DUPLICATE_CLAIM = "duplicate_claim"
    DATA_MISMATCH = "data_mismatch"
    LATE_ATTACHMENT = "late_attachment"
    NULL_FIELD = "null_field"
    BOUNDARY = "boundary"


class JudgmentStatus(Enum):
    INITIAL = "initial"
    REVISED = "revised"
    CONFIRMED = "confirmed"


@dataclass
class BaseRecord:
    record_id: str
    record_type: RecordType
    source_file: str
    batch_id: str
    amount: Optional[float] = None
    currency: str = "CNY"
    date: Optional[str] = None
    description: str = ""
    raw_data: dict = field(default_factory=dict)


@dataclass
class PaymentRecord(BaseRecord):
    payer: str = ""
    payee: str = ""
    transaction_no: str = ""
    settlement_status: str = ""


@dataclass
class RefundRecord(BaseRecord):
    original_payment_id: str = ""
    refund_reason: str = ""
    applicant: str = ""
    approval_status: str = ""


@dataclass
class ApprovalRecord(BaseRecord):
    email_subject: str = ""
    sender: str = ""
    recipients: str = ""
    approval_action: str = ""
    related_record_id: str = ""


@dataclass
class NoteRecord(BaseRecord):
    author: str = ""
    category: str = ""
    content: str = ""


@dataclass
class AttachmentIndex:
    attachment_id: str
    related_record_id: str
    file_name: str
    file_path: str
    uploaded_at: str
    is_late: bool = False


@dataclass
class ConflictEntry:
    conflict_id: str
    conflict_type: ConflictStatus
    record_ids: list = field(default_factory=list)
    evidence: dict = field(default_factory=dict)
    suggested_action: str = ""
    resolved: bool = False
    resolution_note: str = ""


@dataclass
class JudgmentChange:
    record_id: str
    old_judgment: str
    new_judgment: str
    change_reason: str
    changed_at: str
    changed_by: str = "system"
    attachment_id: Optional[str] = None


@dataclass
class LookbackResult:
    run_id: str
    run_at: str
    total_records: int = 0
    conflict_count: int = 0
    duplicate_claim_count: int = 0
    late_attachment_count: int = 0
    null_field_count: int = 0
    boundary_count: int = 0
    judgment_changes: list = field(default_factory=list)
    conflicts: list = field(default_factory=list)
    summary_amount: float = 0.0
    exception_amount: float = 0.0
