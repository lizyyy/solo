from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class TaskBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    max_execution_time: int = Field(default=300, ge=1)
    heartbeat_interval: int = Field(default=30, ge=1)
    is_active: bool = True


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    id: int
    name: str
    description: Optional[str]
    max_execution_time: int
    heartbeat_interval: int
    created_at: datetime
    updated_at: Optional[datetime]
    is_active: bool

    class Config:
        from_attributes = True


class LockBase(BaseModel):
    task_id: int
    instance_id: str


class AcquireLockRequest(BaseModel):
    task_name: str
    instance_id: str
    execution_window_start: Optional[datetime] = None
    execution_window_end: Optional[datetime] = None


class LockSchema(BaseModel):
    id: int
    task_id: int
    instance_id: str
    status: str
    acquired_at: datetime
    released_at: Optional[datetime]
    expires_at: datetime
    last_heartbeat_at: datetime
    execution_window_start: Optional[datetime]
    execution_window_end: Optional[datetime]
    acquire_attempts: int
    failed_reason: Optional[str]

    class Config:
        from_attributes = True


class ExecutionLogBase(BaseModel):
    task_id: int
    lock_id: Optional[int] = None
    instance_id: str
    status: str = "pending"
    result: Optional[str] = None
    error_message: Optional[str] = None
    error_stack: Optional[str] = None


class ExecutionLogSchema(BaseModel):
    id: int
    task_id: int
    lock_id: Optional[int]
    instance_id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[float]
    result: Optional[str]
    error_message: Optional[str]
    error_stack: Optional[str]
    is_duplicate: bool
    compensation_action: Optional[str]
    compensation_note: Optional[str]

    class Config:
        from_attributes = True


class AbnormalQueueSchema(BaseModel):
    id: int
    task_id: int
    execution_log_id: Optional[int]
    lock_id: Optional[int]
    instance_id: str
    abnormal_type: str
    description: Optional[str]
    severity: str
    detected_at: datetime
    resolved_at: Optional[datetime]
    is_resolved: bool
    resolution_note: Optional[str]
    task_name: Optional[str] = None

    class Config:
        from_attributes = True


class HeartbeatRequest(BaseModel):
    task_name: str
    instance_id: str


class ReleaseLockRequest(BaseModel):
    task_name: str
    instance_id: str
    success: bool = True
    result: Optional[str] = None
    error_message: Optional[str] = None


class TaskStatusUpdate(BaseModel):
    status: str
    result: Optional[str] = None
    error_message: Optional[str] = None


class LockAcquireResponse(BaseModel):
    success: bool
    message: str
    lock_id: Optional[int] = None
    task_id: Optional[int] = None


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class TaskSchema(BaseModel):
    id: int
    name: str
    description: Optional[str]
    max_execution_time: int
    heartbeat_interval: int
    created_at: datetime
    updated_at: Optional[datetime]
    is_active: bool

    class Config:
        from_attributes = True


class TaskDetailResponse(TaskSchema):
    current_lock: Optional[LockSchema] = None
    recent_logs: List[ExecutionLogSchema] = []


class AbnormalResolveRequest(BaseModel):
    resolution_note: Optional[str] = None
