from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models import TaskStatus, StepType


class StepLogResponse(BaseModel):
    id: int
    step_type: StepType
    status: str
    message: Optional[str]
    duration_seconds: int
    created_at: datetime

    class Config:
        from_attributes = True


class RetryLogResponse(BaseModel):
    id: int
    retry_number: int
    failed_step: StepType
    error_message: str
    created_at: datetime

    class Config:
        from_attributes = True


class DeadLetterResponse(BaseModel):
    id: int
    reason: str
    last_error: str
    created_at: datetime
    replayed: int

    class Config:
        from_attributes = True


class TaskResponse(BaseModel):
    id: str
    contract_name: str
    status: TaskStatus
    celery_task_id: Optional[str]
    retry_count: int
    max_retries: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    step_logs: List[StepLogResponse] = []
    retries: List[RetryLogResponse] = []
    dead_letter: Optional[DeadLetterResponse] = None

    class Config:
        from_attributes = True


class TaskCreateRequest(BaseModel):
    contract_name: str
    force_fail: Optional[str] = None


class TaskCreateResponse(BaseModel):
    task_id: str
    celery_task_id: str
    message: str


class TaskCancelResponse(BaseModel):
    task_id: str
    status: str
    message: str


class DeadLetterReplayResponse(BaseModel):
    dead_letter_id: int
    task_id: str
    status: str
    message: str


class TaskListResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int
