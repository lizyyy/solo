from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field

from app.config import settings


class GPUBase(BaseModel):
    gpu_id: str
    name: str
    model: Optional[str] = None
    memory_gb: Optional[int] = None


class GPUCreate(GPUBase):
    pass


class GPUOut(GPUBase):
    id: int
    status: str
    current_task_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    name: str
    user_id: str
    priority: int = Field(default=settings.default_priority, ge=1, le=10)
    estimated_duration_minutes: int = Field(default=settings.default_max_duration_minutes, ge=1)
    timeout_minutes: int = Field(default=settings.default_timeout_minutes, ge=1)
    max_retries: int = Field(default=settings.max_retry_count, ge=0, le=10)
    command: Optional[str] = None
    script_path: Optional[str] = None
    output_path: Optional[str] = None


class TaskCreate(TaskBase):
    pass


class TaskOut(TaskBase):
    id: int
    task_id: str
    status: str
    queue_position: Optional[int] = None
    retry_count: int
    submitted_at: Optional[datetime] = None
    queued_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    gpu_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TaskDetail(TaskOut):
    gpu: Optional[GPUOut] = None


class TaskHistoryOut(BaseModel):
    id: int
    task_id: int
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    reason: Optional[str] = None
    details: Optional[str] = None
    gpu_id: Optional[str] = None
    queue_position: Optional[int] = None
    timestamp: datetime
    
    class Config:
        from_attributes = True


class BlockPointOut(BaseModel):
    current_status: str
    block_point: Optional[str] = None
    block_reason: Optional[str] = None
    latest_action: Optional[dict] = None
    previous_action: Optional[dict] = None
    queue_position: Optional[int] = None
    retry_count: int
    max_retries: int


class BillOut(BaseModel):
    id: int
    bill_id: str
    task_id: int
    user_id: str
    gpu_name: Optional[str] = None
    gpu_memory_gb: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    total_seconds: int
    base_cost: float
    premium_cost: float
    total_cost: float
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SchedulerLogOut(BaseModel):
    id: int
    event_type: str
    task_id: Optional[str] = None
    gpu_id: Optional[str] = None
    message: str
    details: Optional[str] = None
    success: bool
    timestamp: datetime
    
    class Config:
        from_attributes = True


class SchedulerReportOut(BaseModel):
    generated_at: datetime
    total_gpus: int
    available_gpus: int
    occupied_gpus: int
    maintenance_gpus: int
    
    total_tasks: int
    queued_tasks: int
    running_tasks: int
    succeeded_tasks: int
    failed_tasks: int
    timed_out_tasks: int
    cancelled_tasks: int
    
    queue_summary: List[dict]
    recent_activities: List[SchedulerLogOut]


class MessageOut(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


class TaskListOut(BaseModel):
    total: int
    items: List[TaskOut]


class HistoryListOut(BaseModel):
    total: int
    items: List[TaskHistoryOut]
