from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TaskBatchBase(BaseModel):
    batch_id: str
    task_type: Optional[str] = None
    total_tasks: int = 0
    failed_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TaskBatchCreate(TaskBatchBase):
    pass


class TaskBatchUpdate(BaseModel):
    status: Optional[str] = None
    failed_count: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class TaskBatchResponse(TaskBatchBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FailureReasonBase(BaseModel):
    reason_code: str
    reason_message: Optional[str] = None
    count: int = 1
    task_ids: List[str] = Field(default_factory=list)


class FailureReasonCreate(FailureReasonBase):
    pass


class FailureReasonResponse(FailureReasonBase):
    id: int
    batch_id: int
    first_failed_at: datetime
    last_failed_at: datetime

    class Config:
        from_attributes = True


class RerunBudgetBase(BaseModel):
    reason_code: str
    budget_window_hours: int = 24
    max_reruns: int = 3


class RerunBudgetCreate(RerunBudgetBase):
    pass


class RerunBudgetUpdate(BaseModel):
    used_reruns: Optional[int] = None
    is_active: Optional[bool] = None
    budget_window_hours: Optional[int] = None
    max_reruns: Optional[int] = None


class RerunBudgetResponse(RerunBudgetBase):
    id: int
    batch_id: int
    used_reruns: int
    window_start: datetime
    window_end: datetime
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RejectionRecordBase(BaseModel):
    reason_code: Optional[str] = None
    rejection_reason: str
    original_request: Optional[Dict[str, Any]] = Field(default_factory=dict)
    processing_context: Optional[Dict[str, Any]] = Field(default_factory=dict)
    rejected_by: str = "system"


class RejectionRecordCreate(RejectionRecordBase):
    pass


class RejectionRecordResponse(RejectionRecordBase):
    id: int
    batch_id: int
    rejected_at: datetime

    class Config:
        from_attributes = True


class RerunSummaryBase(BaseModel):
    reason_code: str
    rerun_number: int = 1
    tasks_submitted: int = 0


class RerunSummaryCreate(RerunSummaryBase):
    pass


class RerunSummaryUpdate(BaseModel):
    status: Optional[str] = None
    tasks_succeeded: Optional[int] = None
    tasks_failed: Optional[int] = None
    result_metadata: Optional[Dict[str, Any]] = None
    completed_at: Optional[datetime] = None


class RerunSummaryResponse(RerunSummaryBase):
    id: int
    batch_id: int
    status: str
    initiated_at: datetime
    completed_at: Optional[datetime]
    tasks_succeeded: int
    tasks_failed: int
    result_metadata: Dict[str, Any]

    class Config:
        from_attributes = True


class RerunRequest(BaseModel):
    batch_id: str
    reason_code: str
    task_ids: Optional[List[str]] = None
    requested_by: str = "system"


class RerunResponse(BaseModel):
    approved: bool
    message: str
    summary_id: Optional[int] = None
    remaining_budget: Optional[int] = None
    rejection_reason: Optional[str] = None


class BudgetStatusUpdate(BaseModel):
    summary_id: int
    status: str
    tasks_succeeded: Optional[int] = None
    tasks_failed: Optional[int] = None
    result_metadata: Optional[Dict[str, Any]] = None


class ManualCorrection(BaseModel):
    batch_id: str
    reason_code: Optional[str] = None
    adjustment_type: str
    adjustment_value: Any
    corrected_by: str
    comment: Optional[str] = None


class BatchDetailResponse(BaseModel):
    batch: TaskBatchResponse
    failure_reasons: List[FailureReasonResponse]
    rerun_budgets: List[RerunBudgetResponse]
    rejection_records: List[RejectionRecordResponse]
    rerun_summaries: List[RerunSummaryResponse]


class ExportFilter(BaseModel):
    batch_ids: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    reason_codes: Optional[List[str]] = None
    status: Optional[str] = None
