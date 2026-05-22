from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

from app.models import UserRole, BatchStatus, DirtyRecordType, AttachmentType


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserForList(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True


class BoxItemBase(BaseModel):
    box_no: str
    original_box_no: Optional[str] = None
    product_name: Optional[str] = None
    quantity: Optional[int] = None
    unit_price: Optional[float] = None
    amount: Optional[float] = None
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None
    temperature_avg: Optional[float] = None
    is_abnormal: bool = False
    remark: Optional[str] = None


class BoxItemCreate(BoxItemBase):
    pass


class BoxItemUpdate(BaseModel):
    box_no: Optional[str] = None
    original_box_no: Optional[str] = None
    product_name: Optional[str] = None
    quantity: Optional[int] = None
    unit_price: Optional[float] = None
    amount: Optional[float] = None
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None
    temperature_avg: Optional[float] = None
    is_abnormal: Optional[bool] = None
    remark: Optional[str] = None


class BoxItem(BoxItemBase):
    id: int
    batch_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class StatusTransitionBase(BaseModel):
    from_status: Optional[BatchStatus] = None
    to_status: BatchStatus
    reason: str


class StatusTransition(StatusTransitionBase):
    id: int
    batch_id: int
    transition_time: datetime
    operator_id: int
    operator: Optional[UserForList] = None

    class Config:
        from_attributes = True


class AttachmentBase(BaseModel):
    file_type: AttachmentType
    file_name: str
    description: Optional[str] = None


class AttachmentCreate(AttachmentBase):
    file_path: str
    file_size: Optional[int] = None
    uploader_id: Optional[int] = None


class Attachment(AttachmentBase):
    id: int
    batch_id: int
    file_path: str
    file_size: Optional[int]
    upload_time: datetime
    uploader_id: Optional[int]

    class Config:
        from_attributes = True


class DirtyRecordBase(BaseModel):
    record_type: DirtyRecordType
    source_data: str
    handling_suggestion: Optional[str] = None


class DirtyRecordCreate(DirtyRecordBase):
    missing_fields: Optional[str] = None
    cross_day_info: Optional[str] = None
    old_box_no: Optional[str] = None
    new_box_no: Optional[str] = None
    conflict_field: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class DirtyRecordResolve(BaseModel):
    resolution_note: str


class DirtyRecord(DirtyRecordBase):
    id: int
    batch_id: int
    missing_fields: Optional[str]
    cross_day_info: Optional[str]
    old_box_no: Optional[str]
    new_box_no: Optional[str]
    conflict_field: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    is_resolved: bool
    resolved_by: Optional[int]
    resolved_at: Optional[datetime]
    resolution_note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SupervisorNoteBase(BaseModel):
    content: str
    is_approval: bool = False


class SupervisorNoteCreate(SupervisorNoteBase):
    pass


class SupervisorNote(SupervisorNoteBase):
    id: int
    batch_id: int
    author_id: int
    author: Optional[UserForList] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    batch_no: str
    transport_order_no: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    departure_date: Optional[datetime] = None
    arrival_date: Optional[datetime] = None
    total_boxes: Optional[int] = None
    total_amount: Optional[float] = None


class BatchCreate(BatchBase):
    box_items: Optional[List[BoxItemCreate]] = None


class BatchUpdate(BaseModel):
    transport_order_no: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    departure_date: Optional[datetime] = None
    arrival_date: Optional[datetime] = None
    total_boxes: Optional[int] = None
    total_amount: Optional[float] = None


class Batch(BatchBase):
    id: int
    current_status: BatchStatus
    status_before_frozen: Optional[BatchStatus]
    frozen_reason: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BatchDetail(Batch):
    status_history: List[StatusTransition] = []
    attachments: List[Attachment] = []
    dirty_records: List[DirtyRecord] = []
    box_items: List[BoxItem] = []
    notes: List[SupervisorNote] = []


class BatchList(BaseModel):
    batches: List[Batch]
    total: int
    page: int
    page_size: int


class StatusChangeRequest(BaseModel):
    target_status: BatchStatus
    reason: str


class BatchQueryParams(BaseModel):
    status: Optional[BatchStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    search: Optional[str] = None
    page: int = 1
    page_size: int = 20
