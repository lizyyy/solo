from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

from app.models import RoleEnum, WorkflowStatus, RecordType, DirtyType


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserBase(BaseModel):
    username: str = Field(..., max_length=50)
    real_name: str = Field(..., max_length=50)
    role: RoleEnum
    department: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class ConsumableRecordBase(BaseModel):
    record_type: RecordType
    title: str = Field(..., max_length=200)
    department: Optional[str] = Field(None, max_length=100)
    research_group: Optional[str] = Field(None, max_length=100)
    teacher_name: Optional[str] = Field(None, max_length=50)
    material_name: Optional[str] = Field(None, max_length=200)
    specification: Optional[str] = Field(None, max_length=100)
    quantity: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=20)
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    supplier: Optional[str] = Field(None, max_length=200)
    purchase_order_no: Optional[str] = Field(None, max_length=50)
    invoice_no: Optional[str] = Field(None, max_length=50)
    request_date: Optional[datetime] = None
    arrival_date: Optional[datetime] = None
    sign_date: Optional[datetime] = None
    inventory_date: Optional[datetime] = None
    borrower: Optional[str] = Field(None, max_length=50)
    expected_return_date: Optional[datetime] = None
    actual_return_date: Optional[datetime] = None
    loss_reason: Optional[str] = None
    refund_reason: Optional[str] = None
    refund_amount: Optional[float] = None
    remarks: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class ConsumableRecordCreate(ConsumableRecordBase):
    pass


class ConsumableRecordUpdate(ConsumableRecordBase):
    title: Optional[str] = Field(None, max_length=200)
    record_type: Optional[RecordType] = None


class ConsumableRecordResponse(ConsumableRecordBase):
    id: int
    record_no: str
    status: WorkflowStatus
    version: int
    is_dirty: bool
    created_by: Optional[int]
    created_at: datetime
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]
    second_confirmed_by: Optional[int]
    second_confirmed_at: Optional[datetime]
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    reject_reason: Optional[str] = None

    class Config:
        from_attributes = True


class WorkflowAction(BaseModel):
    action: str
    remarks: Optional[str] = None
    change_reason: Optional[str] = None


class DirtyRecordBase(BaseModel):
    original_record_id: int
    dirty_type: DirtyType
    field_name: Optional[str] = None
    original_value: Optional[str] = None
    expected_value: Optional[str] = None
    conflict_description: Optional[str] = None
    original_content: Optional[Dict[str, Any]] = None
    processing_opinion: Optional[str] = None


class DirtyRecordCreate(DirtyRecordBase):
    pass


class DirtyRecordResponse(DirtyRecordBase):
    id: int
    is_resolved: bool
    resolved_by: Optional[int]
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class WorkflowLogResponse(BaseModel):
    id: int
    record_id: int
    action: str
    from_status: Optional[WorkflowStatus]
    to_status: Optional[WorkflowStatus]
    operator_id: Optional[int]
    operator_name: Optional[str]
    operator_role: Optional[RoleEnum]
    remarks: Optional[str]
    change_reason: Optional[str]
    changed_fields: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str]
    real_name: Optional[str]
    role: Optional[RoleEnum]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[int]
    ip_address: Optional[str]
    is_sensitive: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResponse(BaseModel):
    batch_no: str
    total_count: int
    success_count: int
    dirty_count: int
    duplicate_count: int
    message: str


class ExportRequest(BaseModel):
    record_type: Optional[RecordType] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[WorkflowStatus] = None
    include_sensitive: bool = False
    export_format: str = Field(default="excel", pattern="^(excel|csv)$")


class DashboardStats(BaseModel):
    total_records: int
    draft_count: int
    submitted_count: int
    approved_count: int
    rejected_count: int
    dirty_count: int
    total_amount: float
    records_by_type: Dict[str, int]
    records_by_department: Dict[str, int]


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
