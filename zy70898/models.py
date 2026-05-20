from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class VerificationStatus(str, Enum):
    PENDING = "pending"
    MATCHED = "matched"
    DISCREPANCY = "discrepancy"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_MORE_INFO = "needs_more_info"


class DiscrepancyType(str, Enum):
    AMOUNT_MISMATCH = "amount_mismatch"
    MISSING_DOUBLE_SIGN = "missing_double_sign"
    CROSS_DAY_TRANSFER = "cross_day_transfer"
    MISSING_TELLER = "missing_teller"
    DUPLICATE_RECORD = "duplicate_record"
    ERROR_MISMATCH = "error_mismatch"


class ReviewAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_MORE_INFO = "request_more_info"
    RECALCULATE = "recalculate"


class TellerSchedule(BaseModel):
    teller_id: str
    teller_name: str
    date: str
    shift: str
    is_working: bool = True
    assigned_box: Optional[str] = None


class BoxTransferRecord(BaseModel):
    transfer_id: str
    box_id: str
    transfer_date: str
    transfer_time: str
    sender_id: str
    sender_name: str
    receiver_id: str
    receiver_name: str
    cash_amount: float
    check_amount: float
    total_amount: float
    first_signatory: Optional[str] = None
    second_signatory: Optional[str] = None
    first_sign_time: Optional[str] = None
    second_sign_time: Optional[str] = None
    remarks: Optional[str] = None


class ErrorRecord(BaseModel):
    error_id: str
    transfer_id: str
    error_date: str
    error_type: str
    error_description: str
    error_amount: Optional[float] = None
    reporter_id: str
    reporter_name: str
    status: str = "open"
    resolution: Optional[str] = None


class DiscrepancyDetail(BaseModel):
    discrepancy_id: str
    discrepancy_type: DiscrepancyType
    field_name: Optional[str] = None
    expected_value: Optional[Any] = None
    actual_value: Optional[Any] = None
    description: str
    severity: str = "medium"


class TransferReconciliation(BaseModel):
    transfer_id: str
    box_id: str
    original_record: BoxTransferRecord
    verification_status: VerificationStatus = VerificationStatus.PENDING
    discrepancies: List[DiscrepancyDetail] = Field(default_factory=list)
    review_notes: List[str] = Field(default_factory=list)
    review_action: Optional[ReviewAction] = None
    reviewer_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    review_time: Optional[datetime] = None
    adjusted_cash_amount: Optional[float] = None
    adjusted_check_amount: Optional[float] = None
    adjusted_total_amount: Optional[float] = None
    is_adjusted: bool = False


class ReconciliationSummary(BaseModel):
    total_records: int = 0
    matched_records: int = 0
    discrepancy_records: int = 0
    pending_review: int = 0
    reviewed_records: int = 0
    approved_records: int = 0
    rejected_records: int = 0
    needs_more_info: int = 0
    total_cash_amount: float = 0.0
    total_check_amount: float = 0.0
    grand_total: float = 0.0
    discrepancy_breakdown: Dict[str, int] = Field(default_factory=dict)


class ReconciliationResult(BaseModel):
    reconciliation_id: str
    batch_date: str
    created_at: datetime
    summary: ReconciliationSummary
    records: List[TransferReconciliation]
    import_sources: Dict[str, str] = Field(default_factory=dict)
