from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict
from uuid import UUID

from app.models.enums import (
    DataSource,
    BatchStrategy,
    WorkOrderStatus,
    TaskStatus,
    TaskType,
    OperationType
)


class BatchCreate(BaseModel):
    batch_no: str
    source: DataSource
    strategy: BatchStrategy = BatchStrategy.IGNORE
    created_by: str = "system"
    remark: Optional[str] = None


class BatchResponse(BaseModel):
    id: str
    batch_no: str
    source: str
    strategy: str
    total_count: int
    success_count: int
    failed_count: int
    status: str
    created_by: Optional[str]
    created_at: datetime
    remark: Optional[str]

    class Config:
        from_attributes = True


class WorkOrderCreate(BaseModel):
    order_no: str
    pile_no: str
    area: str
    source: DataSource
    alarm_type: str
    alarm_level: str
    alarm_time: datetime
    alarm_content: str
    fault_duration: Optional[float] = None
    handler: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class WorkOrderImport(BaseModel):
    source: DataSource
    data: List[WorkOrderCreate]


class WorkOrderResponse(BaseModel):
    id: str
    order_no: str
    batch_id: Optional[str]
    pile_no: str
    area: str
    source: str
    alarm_type: str
    alarm_level: str
    alarm_time: datetime
    alarm_content: str
    status: str
    status_before_freeze: Optional[str]
    fault_duration: Optional[float]
    fault_duration_before: Optional[float]
    handler: Optional[str]
    reviewer: Optional[str]
    review_reason: Optional[str]
    manual_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    frozen_at: Optional[datetime]
    archived_at: Optional[datetime]

    class Config:
        from_attributes = True


class WorkOrderDetailResponse(WorkOrderResponse):
    status_transitions: List[Dict[str, Any]] = []
    attachments: List[Dict[str, Any]] = []
    audit_logs: List[Dict[str, Any]] = []


class StatusChangeRequest(BaseModel):
    target_status: WorkOrderStatus
    operator: str
    reason: Optional[str] = None
    remark: Optional[str] = None


class ReviewRequest(BaseModel):
    operator: str
    approved: bool
    reason: str
    manual_reason: Optional[str] = None


class FreezeRequest(BaseModel):
    operator: str
    reason: str


class UnfreezeRequest(BaseModel):
    operator: str
    reason: str


class AttachmentUploadResponse(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size: int
    uploaded_by: str
    uploaded_at: datetime


class AsyncTaskResponse(BaseModel):
    id: str
    task_type: str
    status: str
    retry_count: int
    last_error: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    operation_type: str
    operator: str
    operation_time: datetime
    remark: Optional[str]
    before_data: Optional[Dict[str, Any]]
    after_data: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class SummaryExportRequest(BaseModel):
    area: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[WorkOrderStatus] = None


class PageResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]


class BatchImportResponse(BaseModel):
    batch_id: str
    batch_no: str
    strategy: str
    total_count: int
    success_count: int
    failed_count: int
    ignored_count: int
    failed_items: List[Dict[str, Any]] = []
