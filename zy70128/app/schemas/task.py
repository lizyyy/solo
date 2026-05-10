from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel
from app.schemas.base import BaseResponse


class BackgroundTaskCreate(BaseModel):
    task_type: str
    parameters: Optional[Dict[str, Any]] = None
    task_key: Optional[str] = None
    priority: int = 0
    max_retries: int = 3
    scheduled_at: Optional[datetime] = None
    created_by: Optional[str] = None


class BackgroundTaskResponse(BaseResponse):
    task_type: str
    status: str
    task_key: Optional[str]
    priority: int
    parameters: Optional[Dict[str, Any]]
    result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    error_stacktrace: Optional[str]
    retry_count: int
    max_retries: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    scheduled_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    cancelled_by: Optional[str]
    created_by: Optional[str]
    last_error_at: Optional[datetime]
    next_retry_at: Optional[datetime]
    progress_percent: int
    progress_message: Optional[str]
