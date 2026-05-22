from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models.enums import TaskStatus, TaskSource, RetryCategory, OperationType


class OriginalEvidenceBase(BaseModel):
    source_file: str
    source_row_no: Optional[int] = None
    original_value: str
    parsed_value: Optional[str] = None
    field_name: Optional[str] = None


class OriginalEvidenceCreate(OriginalEvidenceBase):
    pass


class OriginalEvidence(OriginalEvidenceBase):
    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatusLogBase(BaseModel):
    from_status: Optional[str] = None
    to_status: str
    operation_type: str
    operator: Optional[str] = None
    remark: Optional[str] = None


class StatusLogCreate(StatusLogBase):
    pass


class StatusLog(StatusLogBase):
    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CompensationTaskBase(BaseModel):
    idempotency_key: str
    source: TaskSource
    box_no: Optional[str] = None
    driver_id: Optional[str] = None
    temperature_record_id: Optional[str] = None
    compensation_amount: float = 0.0


class CompensationTaskCreate(CompensationTaskBase):
    evidences: List[OriginalEvidenceCreate] = Field(default_factory=list)
    max_retry_count: int = 3


class CompensationTaskUpdate(BaseModel):
    box_no: Optional[str] = None
    driver_id: Optional[str] = None
    compensation_amount: Optional[float] = None
    remark: Optional[str] = None


class CompensationTask(CompensationTaskBase):
    id: int
    task_no: str
    status: TaskStatus
    retry_count: int
    max_retry_count: int
    retry_category: Optional[RetryCategory] = None
    last_error: Optional[str] = None
    next_retry_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    evidences: List[OriginalEvidence] = Field(default_factory=list)
    status_logs: List[StatusLog] = Field(default_factory=list)

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    total: int
    items: List[CompensationTask]


class ReceiptSubmitRequest(BaseModel):
    idempotency_key: str
    source: TaskSource
    source_file: str
    source_row_no: Optional[int] = None
    box_no: str
    driver_id: Optional[str] = None
    temperature_record_id: Optional[str] = None
    original_data: Dict[str, Any]
    parsed_data: Optional[Dict[str, Any]] = None
    compensation_amount: float = 0.0


class ManualTakeoverRequest(BaseModel):
    operator: str
    remark: Optional[str] = None
    new_status: TaskStatus
    retry_category: Optional[RetryCategory] = None


class CompensateRequest(BaseModel):
    operator: str
    compensation_amount: float
    remark: Optional[str] = None


class CloseTaskRequest(BaseModel):
    operator: str
    remark: Optional[str] = None


class RetryTaskRequest(BaseModel):
    operator: Optional[str] = None
    remark: Optional[str] = None
