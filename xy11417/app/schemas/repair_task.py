from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.core.config import TaskStatus, RetryCategory

class RepairTaskBase(BaseModel):
    status: Optional[TaskStatus] = TaskStatus.PENDING
    retry_category: Optional[RetryCategory] = None
    manual_review_required: Optional[bool] = False
    compensation_reason: Optional[str] = None

class TaskProcessRequest(BaseModel):
    force_retry: bool = False
    new_retry_category: Optional[RetryCategory] = None
    notes: Optional[str] = None

class CompensationRequest(BaseModel):
    amount: float
    reason: str
    compensation_type: str = "customer_compensation"

class RepairTaskResponse(BaseModel):
    id: int
    task_id: str
    source_data_id: Optional[int] = None
    order_id: Optional[str] = None
    status: TaskStatus
    retry_category: Optional[str] = None
    retry_count: int
    max_retries: int
    next_retry_at: Optional[datetime] = None
    last_retry_at: Optional[datetime] = None
    error_message: Optional[str] = None
    is_repair: bool
    is_part_replacement: bool
    parent_task_id: Optional[str] = None
    merge_with_task_id: Optional[str] = None
    compensation_amount: float
    compensation_reason: Optional[str] = None
    compensated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    manual_review_required: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ProcessLogResponse(BaseModel):
    id: int
    task_id: str
    action: str
    status_before: Optional[str] = None
    status_after: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    performed_by: Optional[int] = None
    performed_at: datetime
    ip_address: Optional[str] = None
    
    class Config:
        from_attributes = True
