from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ApprovalOrderBase(BaseModel):
    order_no: str
    department: str
    applicant: str
    amount: float
    subject: str
    apply_date: datetime
    due_date: datetime
    priority: str = "normal"
    material_summary: Optional[str] = None
    current_approver: Optional[str] = None


class ApprovalOrderCreate(ApprovalOrderBase):
    pass


class ApprovalOrder(ApprovalOrderBase):
    id: int
    status: str
    overdue_days: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BudgetAllocationBase(BaseModel):
    allocated_amount: float
    allocated_budget_code: Optional[str] = None
    allocation_reason: Optional[str] = None


class BudgetAllocationCreate(BudgetAllocationBase):
    order_id: int
    algorithm_version: str


class BudgetAllocation(BudgetAllocationBase):
    id: int
    order_id: int
    algorithm_version: str
    is_overridden: bool
    status: str
    error_message: Optional[str]
    execution_time_ms: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class ManualCorrectionBase(BaseModel):
    corrected_amount: Optional[float] = None
    corrected_budget_code: Optional[str] = None
    correction_reason: str
    corrected_by: str


class ManualCorrectionCreate(ManualCorrectionBase):
    order_id: int
    original_allocation_id: Optional[int] = None


class ManualCorrection(ManualCorrectionBase):
    id: int
    order_id: int
    original_allocation_id: Optional[int]
    system_judgment_snapshot: str
    created_at: datetime

    class Config:
        from_attributes = True


class VersionFreezeBase(BaseModel):
    freeze_note: str
    frozen_by: Optional[str] = None
    algorithm_hash: Optional[str] = None


class VersionFreezeCreate(VersionFreezeBase):
    allocation_id: int


class VersionFreeze(VersionFreezeBase):
    id: int
    allocation_id: int
    frozen_at: datetime

    class Config:
        from_attributes = True


class ProcessLogBase(BaseModel):
    operation_type: str
    status: str
    detail: Optional[str] = None
    execution_time_ms: Optional[int] = None
    operator: Optional[str] = None


class ProcessLogCreate(ProcessLogBase):
    order_id: Optional[int] = None


class ProcessLog(ProcessLogBase):
    id: int
    order_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class AllocationResult(BaseModel):
    order: ApprovalOrder
    system_allocation: BudgetAllocation
    manual_corrections: List[ManualCorrection]
    version_freeze: Optional[VersionFreeze] = None
    process_logs: List[ProcessLog]


class AllocationRequest(BaseModel):
    order_ids: List[int]
    algorithm_version: str = "v1.0.0"
    operator: Optional[str] = None


class CorrectionRequest(BaseModel):
    order_id: int
    corrected_amount: Optional[float] = None
    corrected_budget_code: Optional[str] = None
    correction_reason: str
    corrected_by: str


class QueryFilter(BaseModel):
    status: Optional[str] = None
    department: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    has_error: Optional[bool] = None
    has_correction: Optional[bool] = None


class FreezeRequest(BaseModel):
    allocation_id: int
    freeze_note: str
    frozen_by: Optional[str] = None
