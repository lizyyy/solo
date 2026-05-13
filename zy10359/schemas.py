from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models import TaskStatus, ConversionStage


class TaskBase(BaseModel):
    filename: str
    handler: Optional[str] = "system"


class TaskCreate(TaskBase):
    file_size: int
    file_hash: str
    file_path: str


class TaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    error_message: Optional[str] = None
    failed_stage: Optional[ConversionStage] = None
    preview_url: Optional[str] = None
    preview_path: Optional[str] = None
    completed_at: Optional[datetime] = None


class TaskResponse(BaseModel):
    id: str
    filename: str
    file_size: Optional[int] = None
    status: TaskStatus
    handler: str
    retry_count: int
    max_retries: int
    error_message: Optional[str] = None
    failed_stage: Optional[ConversionStage] = None
    preview_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskRetryRequest(BaseModel):
    handler: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str
    code: str
    task_id: Optional[str] = None
