from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any


class CommissionRecordBase(BaseModel):
    original_line_number: int
    fund_code: Optional[str] = None
    fund_name: Optional[str] = None
    customer_account: Optional[str] = None
    customer_name: Optional[str] = None
    manager_name: Optional[str] = None
    manager_code: Optional[str] = None
    approval_name: Optional[str] = None
    transaction_date: Optional[datetime] = None
    settlement_date: Optional[datetime] = None
    transaction_amount: Optional[float] = None
    commission_rate: Optional[float] = None
    commission_amount: Optional[float] = None
    trail_commission_amount: Optional[float] = None
    split_ratio: float = 1.0
    final_amount: Optional[float] = None


class CommissionRecordCreate(CommissionRecordBase):
    pass


class CommissionRecordUpdate(BaseModel):
    approval_name: Optional[str] = None
    settlement_date: Optional[datetime] = None
    split_ratio: Optional[float] = None
    notes: Optional[str] = None


class CommissionRecord(CommissionRecordBase):
    id: int
    batch_id: int
    approval_name_is_pinyin: bool
    source_type: str
    status: str
    is_duplicate: bool
    manually_modified: bool
    needs_manager_review: bool
    manager_reviewed: bool
    balance_updated: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClearingBatchBase(BaseModel):
    batch_number: str
    imported_by: str = "system"


class ClearingBatchCreate(ClearingBatchBase):
    pass


class ClearingBatch(ClearingBatchBase):
    id: int
    import_date: datetime
    status: str
    total_amount: float
    record_count: int
    holiday_reviewed: bool
    holiday_reviewed_by: Optional[str] = None
    holiday_reviewed_at: Optional[datetime] = None
    records: List[CommissionRecord] = []

    class Config:
        from_attributes = True


class BalanceChangeBase(BaseModel):
    manager_code: str
    manager_name: str
    change_type: str
    amount: float
    balance_before: float
    balance_after: float
    source_type: str
    source_reference: str
    is_pending_confirmation: bool = False
    recorded_by: str = "system"


class BalanceChange(BalanceChangeBase):
    id: int
    commission_record_id: Optional[int] = None
    recorded_at: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    performed_by: str
    notes: Optional[str] = None


class AuditLog(AuditLogBase):
    id: int
    batch_id: Optional[int] = None
    record_id: Optional[int] = None
    performed_at: datetime

    class Config:
        from_attributes = True


class SelfCheckResultBase(BaseModel):
    check_type: str
    check_name: str
    passed: bool
    message: Optional[str] = None
    details: Optional[str] = None
    affected_record_ids: Optional[str] = None


class SelfCheckResult(SelfCheckResultBase):
    id: int
    checked_at: datetime
    batch_id: Optional[int] = None

    class Config:
        from_attributes = True


class SelfCheckReport(BaseModel):
    batch_id: Optional[int] = None
    total_checks: int
    passed_checks: int
    failed_checks: int
    results: List[SelfCheckResult]
    generated_at: datetime


class HolidayAdjustmentBase(BaseModel):
    original_date: datetime
    adjusted_date: datetime
    reason: str
    reviewed_by: str = "老秦"


class ImportResult(BaseModel):
    batch_id: int
    batch_number: str
    total_records: int
    duplicate_count: int
    pinyin_approval_count: int
    needs_review_count: int
    message: str


class WorkflowStep(BaseModel):
    step_name: str
    status: str
    completed_at: Optional[datetime] = None
    performed_by: Optional[str] = None
    notes: Optional[str] = None


class WorkflowStatus(BaseModel):
    batch_id: int
    batch_number: str
    current_step: int
    total_steps: int
    steps: List[WorkflowStep]
    overall_status: str
