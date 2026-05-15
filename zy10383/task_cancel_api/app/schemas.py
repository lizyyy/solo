from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models import TaskStatus, PropagationStatus, CleanupStatus


class MainTaskBase(BaseModel):
    task_id: str
    name: str
    description: Optional[str] = None


class MainTaskCreate(MainTaskBase):
    pass


class MainTaskResponse(MainTaskBase):
    id: int
    status: TaskStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubTaskBase(BaseModel):
    sub_task_id: str
    name: str
    description: Optional[str] = None
    order: int = 0


class SubTaskCreate(SubTaskBase):
    pass


class SubTaskResponse(SubTaskBase):
    id: int
    main_task_id: int
    status: TaskStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CancelReasonBase(BaseModel):
    reason_code: str
    reason_message: str
    triggered_by: Optional[str] = None
    suppress_notification: bool = False


class CancelReasonCreate(CancelReasonBase):
    pass


class CancelReasonResponse(CancelReasonBase):
    id: int
    main_task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TempResourceBase(BaseModel):
    resource_id: str
    resource_type: str
    resource_location: Optional[str] = None
    size_bytes: Optional[int] = None


class TempResourceCreate(TempResourceBase):
    pass


class TempResourceResponse(TempResourceBase):
    id: int
    sub_task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PropagationStateResponse(BaseModel):
    id: int
    main_task_id: int
    status: PropagationStatus
    current_sub_task_index: int
    total_sub_tasks: int
    completed_sub_tasks: int
    failed_sub_tasks: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CleanupResultResponse(BaseModel):
    id: int
    result_id: str
    sub_task_id: int
    resource_id: Optional[str] = None
    status: CleanupStatus
    detail: Optional[str] = None
    cleaned_count: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskCancelRequest(BaseModel):
    task_id: str
    reason_code: str
    reason_message: str
    triggered_by: Optional[str] = None
    suppress_notification: bool = False
    idempotency_key: Optional[str] = None


class TaskDetailResponse(BaseModel):
    main_task: MainTaskResponse
    sub_tasks: List[SubTaskResponse]
    cancel_reason: Optional[CancelReasonResponse] = None
    propagation: Optional[PropagationStateResponse] = None


class PropagationProgressResponse(BaseModel):
    main_task_id: str
    status: PropagationStatus
    progress: float
    total: int
    completed: int
    failed: int
    error_message: Optional[str] = None


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    detail: Optional[str] = None
    timestamp: datetime
