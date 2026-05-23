from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List
from ..models.enums import TaskStatus, TaskType


class TaskBase(BaseModel):
    task_type: TaskType
    parameters: Optional[Dict[str, Any]] = None
    priority: int = 0
    max_retries: int = 3


class TaskCreate(TaskBase):
    batch_id: Optional[int] = None
    created_by: Optional[str] = None


class TaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    last_error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


class TaskResponse(TaskBase):
    id: int
    batch_id: Optional[int] = None
    status: TaskStatus
    retry_count: int
    last_error: Optional[str] = None
    next_retry_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    result: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    total: int
    items: List[TaskResponse]
    page: int
    page_size: int


class ManualRetryRequest(BaseModel):
    task_id: int
    retried_by: str
    comment: Optional[str] = None


class ManualResolveRequest(BaseModel):
    task_id: int
    resolved_by: str
    resolution: str
    result: Optional[Dict[str, Any]] = None
