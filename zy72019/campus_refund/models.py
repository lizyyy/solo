from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PaymentRecord(BaseModel):
    transaction_id: str
    card_no: str
    student_name: str
    amount: float
    payment_time: str
    description: str = ""
    source: str = "manual"


class RefundApplication(BaseModel):
    application_no: str
    transaction_id: str
    card_no: str
    student_name: str
    refund_amount: float
    reason: str = ""
    applicant: str = ""
    apply_time: str
    status: str = "pending"


class ApprovalRecord(BaseModel):
    application_no: str
    approver: str
    approval_time: str
    approval_result: str
    remarks: str = ""
    email_subject: str = ""


class ManualNote(BaseModel):
    application_no: str
    note_content: str
    operator: str
    note_time: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    note_type: str = "general"


class BatchCreate(BaseModel):
    batch_no: str
    period_start: str
    period_end: str
    created_by: str
    application_nos: list[str] = []


class BatchConfirm(BaseModel):
    confirmed_by: str


class ReconciliationEntry(BaseModel):
    period: str
    category: str = "校园一卡通退款清算"
    expected_amount: float
    actual_amount: float = 0
    difference: float = 0
    source: str = "manual"
    description: str = ""


class ImportStrategy(BaseModel):
    on_duplicate: str = "conflict"
    conflict_resolution: str = "pending"


class ConflictResolution(BaseModel):
    conflict_id: int
    resolution: str
    resolved_by: str


class RefundStatusUpdate(BaseModel):
    status: str
    rework_reason: str = ""
    operator: str


class ExportRequest(BaseModel):
    batch_no: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    include_notes: bool = True
    include_approvals: bool = True
