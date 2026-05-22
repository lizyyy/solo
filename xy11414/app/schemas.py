from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

from app.models import UserRole, RecordStatus, DirtyType


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserBase(BaseModel):
    username: str
    full_name: str
    role: UserRole
    franchise_id: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class LedgerRecordBase(BaseModel):
    franchise_id: str
    franchise_name: Optional[str] = None
    record_date: datetime
    material_name: Optional[str] = None
    material_code: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    order_quantity: Optional[float] = None
    order_amount: Optional[float] = None
    loss_quantity: Optional[float] = None
    loss_amount: Optional[float] = None
    headquarter_price: Optional[float] = None
    source_order_no: Optional[str] = None
    source_loss_no: Optional[str] = None
    change_reason: Optional[str] = None
    remarks: Optional[str] = None


class LedgerRecordCreate(LedgerRecordBase):
    raw_data: Optional[Dict[str, Any]] = None


class LedgerRecordUpdate(BaseModel):
    franchise_name: Optional[str] = None
    record_date: Optional[datetime] = None
    material_name: Optional[str] = None
    material_code: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    order_quantity: Optional[float] = None
    order_amount: Optional[float] = None
    loss_quantity: Optional[float] = None
    loss_amount: Optional[float] = None
    headquarter_price: Optional[float] = None
    source_order_no: Optional[str] = None
    source_loss_no: Optional[str] = None
    change_reason: Optional[str] = None
    remarks: Optional[str] = None
    processing_notes: Optional[str] = None


class StatusHistoryResponse(BaseModel):
    id: int
    from_status: Optional[RecordStatus] = None
    to_status: RecordStatus
    changed_by: Optional[int] = None
    changed_at: datetime
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class DirtyRecordResponse(BaseModel):
    id: int
    dirty_type: DirtyType
    field_name: Optional[str] = None
    original_value: Optional[str] = None
    current_value: Optional[str] = None
    expected_value: Optional[str] = None
    description: Optional[str] = None
    is_resolved: bool
    resolution_notes: Optional[str] = None

    class Config:
        from_attributes = True


class FieldChangeLogResponse(BaseModel):
    id: int
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: Optional[int] = None
    changed_at: datetime
    change_reason: Optional[str] = None

    class Config:
        from_attributes = True


class LedgerRecordResponse(BaseModel):
    id: int
    record_no: str
    franchise_id: str
    franchise_name: Optional[str] = None
    record_date: datetime
    status: RecordStatus
    material_name: Optional[str] = None
    material_code: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    order_quantity: Optional[float] = None
    order_amount: Optional[float] = None
    loss_quantity: Optional[float] = None
    loss_amount: Optional[float] = None
    headquarter_price: Optional[float] = None
    source_order_no: Optional[str] = None
    source_loss_no: Optional[str] = None
    change_reason: Optional[str] = None
    rejection_reason: Optional[str] = None
    remarks: Optional[str] = None
    is_dirty: bool
    dirty_types: Optional[List[str]] = None
    processing_notes: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    confirmed_by: Optional[int] = None
    confirmed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LedgerRecordDetailResponse(LedgerRecordResponse):
    status_history: List[StatusHistoryResponse]
    dirty_records: List[DirtyRecordResponse]
    field_changes: List[FieldChangeLogResponse]

    class Config:
        from_attributes = True


class LedgerRecordListResponse(BaseModel):
    total: int
    items: List[LedgerRecordResponse]


class StatusChangeRequest(BaseModel):
    reason: Optional[str] = None
    rejection_reason: Optional[str] = None


class DirtyRecordResolveRequest(BaseModel):
    resolution_notes: str


class BatchImportRequest(BaseModel):
    order_data: List[Dict[str, Any]] = Field(default_factory=list)
    loss_data: List[Dict[str, Any]] = Field(default_factory=list)
    headquarter_price_data: List[Dict[str, Any]] = Field(default_factory=list)


class ExportRequest(BaseModel):
    record_ids: Optional[List[int]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    franchise_id: Optional[str] = None
    masked: bool = True


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RoleViewConfig(BaseModel):
    role: UserRole
    visible_fields: List[str]
    editable_fields: List[str]
