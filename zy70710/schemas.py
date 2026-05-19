from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import List, Optional, Dict
from models import TaskStatus, RecoveryAction


class ImpactSummaryItem(BaseModel):
    count: int
    types: List[str]


class ImpactItemBase(BaseModel):
    impact_type: str = Field(..., max_length=100)
    impact_description: str
    affected_data: Optional[str] = None
    affected_range: Optional[str] = Field(None, max_length=200)
    severity: str = Field("medium", max_length=50)
    resolution_note: Optional[str] = None


class ImpactItemCreate(ImpactItemBase):
    pass


class ImpactItem(ImpactItemBase):
    id: int
    batch_task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BatchTaskBase(BaseModel):
    task_name: str = Field(..., max_length=200)
    planned_time: datetime


class BatchTaskCreate(BatchTaskBase):
    pass


class BatchTaskUpdateStatus(BaseModel):
    status: TaskStatus
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None


class BatchTaskMarkMissed(BaseModel):
    missed_reason: str


class BatchTaskRecover(BaseModel):
    recovery_action: RecoveryAction
    recovered_by: str = Field(..., max_length=100)
    impact_items: Optional[List[ImpactItemCreate]] = None


class BatchTask(BatchTaskBase):
    id: int
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    status: TaskStatus
    missed_reason: Optional[str] = None
    recovery_action: Optional[RecoveryAction] = None
    recovery_time: Optional[datetime] = None
    recovered_by: Optional[str] = None
    is_impact_calculated: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    impact_items: List[ImpactItem] = []

    class Config:
        from_attributes = True


class RecoveryReport(BaseModel):
    task_id: int
    task_name: str
    planned_time: datetime
    missed_reason: str
    recovery_action: RecoveryAction
    recovery_time: datetime
    recovered_by: str
    impact_count: int
    impact_summary: Dict[str, ImpactSummaryItem]


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


class BatchTaskListResponse(BaseModel):
    total: int
    items: List[BatchTask]
