from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class RefundStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVIEW_REQUIRED = "review_required"
    BLOCKED = "blocked"
    PROCESSED = "processed"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class OrderPayment(BaseModel):
    order_id: str
    user_id: str
    user_account: str
    amount: float
    paid_at: datetime
    currency: str = "CNY"
    status: str = "success"


class BlacklistItem(BaseModel):
    account: str
    reason: str
    added_at: datetime
    added_by: str
    is_active: bool = True


class ApprovalRecord(BaseModel):
    approval_id: str
    order_id: str
    refund_request_id: str
    approver: str
    amount: float
    status: ApprovalStatus
    approved_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    reason: Optional[str] = None


class HistoricalRefund(BaseModel):
    refund_id: str
    order_id: str
    amount: float
    processed_at: datetime
    status: str = "success"
    processor: Optional[str] = None


class RefundRequest(BaseModel):
    request_id: str
    order_id: str
    user_account: str
    amount: float
    reason: str
    requested_at: datetime
    requested_by: str
    status: RefundStatus = RefundStatus.PENDING
    check_results: List["CheckResult"] = Field(default_factory=list)
    historical_checks: List["CheckResult"] = Field(default_factory=list)


class CheckResult(BaseModel):
    rule_name: str
    passed: bool
    message: str
    checked_at: datetime
    details: dict = Field(default_factory=dict)


class CorrectionRecord(BaseModel):
    correction_id: str
    request_id: str
    field: str
    old_value: str
    new_value: str
    corrected_by: str
    corrected_at: datetime
    reason: str


class WorkspaceState(BaseModel):
    initialized: bool = False
    initialized_at: Optional[datetime] = None
    last_check_at: Optional[datetime] = None
    last_import_at: Optional[datetime] = None


RefundRequest.model_rebuild()
CheckResult.model_rebuild()
