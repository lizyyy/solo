from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import hashlib
import json

from models import TaskStatus, OperationSource


class TaskCreate(BaseModel):
    tenant_id: str = Field(..., description="租户ID")
    report_type: str = Field(..., description="报表类型")
    filter_conditions: dict = Field(..., description="筛选条件")
    created_by: str = Field(..., description="创建者")
    operation_source: OperationSource = Field(default=OperationSource.USER, description="操作来源")

    def get_task_signature(self) -> str:
        filter_str = json.dumps(self.filter_conditions, sort_keys=True)
        signature = hashlib.md5(f"{self.tenant_id}:{self.report_type}:{filter_str}".encode()).hexdigest()
        return signature


class TaskResponse(BaseModel):
    id: int
    task_no: str
    tenant_id: str
    report_type: str
    filter_conditions: str
    file_size: Optional[int]
    file_url: Optional[str]
    status: TaskStatus
    retry_count: int
    max_retries: int
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]
    error_message: Optional[str]

    class Config:
        orm_mode = True
        from_attributes = True


class TaskUpdateStatus(BaseModel):
    status: TaskStatus
    operator: str
    operation_source: OperationSource
    change_reason: Optional[str] = None
    file_size: Optional[int] = None
    file_url: Optional[str] = None
    error_message: Optional[str] = None


class TaskRetry(BaseModel):
    operator: str
    operation_source: OperationSource = OperationSource.RETRY_JOB
    change_reason: Optional[str] = "手动重试"


class HistoryResponse(BaseModel):
    id: int
    task_id: int
    status: TaskStatus
    operation_source: OperationSource
    operator: str
    change_reason: Optional[str]
    file_size: Optional[int]
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class TaskWithHistory(TaskResponse):
    history: list[HistoryResponse]


class ConflictDetectionResponse(BaseModel):
    has_conflict: bool
    existing_tasks: list[TaskResponse]
    message: str


class BadRowImportRequest(BaseModel):
    task_no: str
    row_data: dict
    error_message: str
    operator: str
