from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from models import TicketStatus


class ErrorEventCreate(BaseModel):
    idempotency_key: str = Field(..., description="幂等性键，防止重复提交")
    ticket_id: str = Field(..., description="工单ID")
    title: str = Field(..., description="工单标题")
    description: Optional[str] = Field(None, description="工单描述")
    error_code: Optional[str] = Field(None, description="错误码")
    error_message: Optional[str] = Field(None, description="错误信息")
    api_path: Optional[str] = Field(None, description="API路径")
    stack_trace: Optional[str] = Field(None, description="堆栈信息")
    severity: Optional[str] = Field("medium", description="严重程度")
    extra_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="元数据")


class ErrorEventResponse(BaseModel):
    id: int
    idempotency_key: str
    ticket_id: str
    title: str
    description: Optional[str]
    error_code: Optional[str]
    error_message: Optional[str]
    api_path: Optional[str]
    severity: str
    status: TicketStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class AttributionRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    error_code_pattern: Optional[str] = None
    api_path_pattern: Optional[str] = None
    keyword_pattern: Optional[str] = None
    root_cause_tag: Optional[str] = None
    assignee: Optional[str] = None
    priority: int = 0


class AttributionRuleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    priority: int
    created_at: datetime

    class Config:
        from_attributes = True


class RootCauseLabelCreate(BaseModel):
    ticket_id: int
    root_cause_category: str
    root_cause_detail: Optional[str] = None
    confidence_score: int = 0
    tagged_by: Optional[str] = None


class DispatchRecordCreate(BaseModel):
    ticket_id: int
    assignee: str
    dispatch_note: Optional[str] = None


class StatusTransitionRequest(BaseModel):
    ticket_id: int
    target_status: TicketStatus
    reason: Optional[str] = None
    changed_by: Optional[str] = None


class SimilarTicketResponse(BaseModel):
    id: int
    similar_ticket_id: int
    similar_ticket_title: str
    similarity_score: int
    merged: bool

    class Config:
        from_attributes = True


class AttributionReportResponse(BaseModel):
    ticket_id: str
    title: str
    status: TicketStatus
    matched_rules: List[str]
    similar_tickets_count: int
    root_cause_category: Optional[str]
    assignee: Optional[str]
    created_at: datetime


class ErrorResponse(BaseModel):
    error: str
    code: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]