from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models import RiskType, ProcessingStatus, TokenStatus


class TokenBase(BaseModel):
    subject: str
    risk_type: Optional[str] = None
    expires_at: datetime
    token_metadata: Optional[Dict[str, Any]] = None


class TokenCreate(TokenBase):
    pass


class TokenResponse(TokenBase):
    id: int
    token_value: str
    batch_id: Optional[int] = None
    status: str
    issued_at: datetime
    issued_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    batch_no: str
    operator: str
    description: Optional[str] = None
    risk_type: str


class BatchCreate(BatchBase):
    items: List[Dict[str, Any]]


class BatchResponse(BatchBase):
    id: int
    status: str
    content_hash: Optional[str] = None
    total_count: int
    success_count: int
    failed_count: int
    start_time: datetime
    end_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BatchDetailResponse(BatchResponse):
    tokens: List[TokenResponse] = []


class FailedItemBase(BaseModel):
    item_key: str
    content: Dict[str, Any]
    error_type: str
    error_message: str
    stack_trace: Optional[str] = None


class FailedItemResponse(FailedItemBase):
    id: int
    batch_id: int
    retry_count: int
    resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingRecordBase(BaseModel):
    record_type: str
    content_before: Optional[Dict[str, Any]] = None
    content_after: Optional[Dict[str, Any]] = None
    status: str
    operator: str
    execution_time_ms: int
    remarks: Optional[str] = None


class ProcessingRecordResponse(ProcessingRecordBase):
    id: int
    batch_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateListBase(BaseModel):
    list_type: str
    name: str
    description: Optional[str] = None
    items: List[Dict[str, Any]]


class CandidateListCreate(CandidateListBase):
    batch_id: int


class CandidateListResponse(CandidateListBase):
    id: int
    batch_id: int
    approved: bool
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    executed: bool
    executed_at: Optional[datetime] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalItemBase(BaseModel):
    item_key: str
    title: str
    content: Dict[str, Any]
    assignee: str
    priority: str = "normal"
    due_date: Optional[datetime] = None


class ApprovalItemResponse(ApprovalItemBase):
    id: int
    batch_id: int
    status: str
    reminders_count: int
    last_reminder_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReportBase(BaseModel):
    report_type: str
    title: str
    summary: str
    comparison_data: Dict[str, Any]
    execution_stats: Dict[str, Any]
    next_steps: List[Dict[str, Any]]


class ReportResponse(ReportBase):
    id: int
    batch_id: int
    generated_by: str
    generated_at: datetime

    class Config:
        from_attributes = True


class ReuseResponse(BaseModel):
    reused: bool
    message: str
    existing_batch: Optional[BatchResponse] = None


class QueryFilter(BaseModel):
    batch_no: Optional[str] = None
    operator: Optional[str] = None
    risk_type: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ReviewItem(BaseModel):
    status_change: str
    from_status: str
    to_status: str
    change_time: datetime
    operator: str
    approval_item: Optional[ApprovalItemResponse] = None
    remarks: Optional[str] = None


class ReviewResponse(BaseModel):
    batch_id: int
    batch_no: str
    status_changes: List[ReviewItem]
    approval_items: List[ApprovalItemResponse]
    summary: str
