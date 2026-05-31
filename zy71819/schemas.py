from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List, Dict, Any


class BillBase(BaseModel):
    bill_no: str = Field(..., max_length=100)
    bill_type: str = Field(..., max_length=50)
    amount: float
    fee_amount: Optional[float] = 0.0
    bill_date: date
    due_date: date
    payer: Optional[str] = None
    payee: Optional[str] = None
    serial_no: Optional[str] = None
    bank_account: Optional[str] = None
    source_file: Optional[str] = None
    source_type: Optional[str] = None
    remark: Optional[str] = None


class BillCreate(BillBase):
    pass


class BillUpdate(BaseModel):
    bill_no: Optional[str] = None
    amount: Optional[float] = None
    fee_amount: Optional[float] = None
    bill_date: Optional[date] = None
    due_date: Optional[date] = None
    payer: Optional[str] = None
    payee: Optional[str] = None
    serial_no: Optional[str] = None
    bank_account: Optional[str] = None
    status: Optional[str] = None
    anomaly_type: Optional[str] = None
    anomaly_reason: Optional[str] = None
    remark: Optional[str] = None
    operator: Optional[str] = "operator"
    revise_reason: Optional[str] = None


class BillResponse(BillBase):
    id: int
    status: str
    anomaly_type: Optional[str] = None
    anomaly_reason: Optional[str] = None
    related_statement_id: Optional[int] = None
    related_invoice_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewCreate(BaseModel):
    bill_id: int
    review_action: str
    review_reason: Optional[str] = None
    review_evidence: Optional[str] = None
    reviewed_by: Optional[str] = "operator"


class ReviewResponse(BaseModel):
    id: int
    bill_id: int
    review_action: str
    review_result: Optional[str] = None
    review_reason: Optional[str] = None
    review_evidence: Optional[str] = None
    reviewed_by: str
    reviewed_at: datetime
    previous_status: Optional[str] = None
    new_status: Optional[str] = None

    class Config:
        from_attributes = True


class HistoryResponse(BaseModel):
    id: int
    bill_id: int
    operation_type: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    operator: str
    operated_at: datetime
    remark: Optional[str] = None

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    file_id: int
    file_name: str
    record_count: int
    message: str


class BillWithDetails(BillResponse):
    review_records: List[ReviewResponse] = []
    history_records: List[HistoryResponse] = []


class StatisticsResponse(BaseModel):
    total_count: int
    normal_count: int
    pending_count: int
    confirmed_count: int
    disputed_count: int
    revised_count: int
    anomaly_duplicate: int
    anomaly_cross_period: int
    anomaly_suspense: int
    anomaly_refund: int
    anomaly_fee_mismatch: int
    total_amount: float
    due_soon_count: int
