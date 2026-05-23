from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from .models import UserRole, BatchStatus, RecordType, DirtyType


class Token(BaseModel):
    access_token: str
    token_type: str
    role: UserRole


class UserBase(BaseModel):
    username: str
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    batch_no: str
    supplier_name: str
    delivery_date: datetime


class BatchCreate(BatchBase):
    pass


class BatchUpdate(BaseModel):
    supplier_name: Optional[str] = None
    delivery_date: Optional[datetime] = None
    review_comment: Optional[str] = None
    freeze_reason: Optional[str] = None
    archive_reason: Optional[str] = None


class BatchSummary(BaseModel):
    id: int
    batch_no: str
    supplier_name: str
    delivery_date: datetime
    status: BatchStatus
    total_delivery_amount: float
    total_weighing_amount: float
    bad_fruit_deduction: float
    secondary_sorting_loss: float
    final_settlement: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BatchDetail(BatchSummary):
    review_comment: Optional[str]
    freeze_reason: Optional[str]
    archive_reason: Optional[str]

    class Config:
        from_attributes = True


class RecordBase(BaseModel):
    record_type: RecordType
    external_ref_no: str
    raw_content: str
    product_name: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    amount: Optional[float] = None
    record_date: Optional[datetime] = None
    supplier_name_in_record: Optional[str] = None


class RecordCreate(RecordBase):
    batch_id: int


class RecordUpdate(BaseModel):
    product_name: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    amount: Optional[float] = None
    record_date: Optional[datetime] = None
    supplier_name_in_record: Optional[str] = None
    processing_note: Optional[str] = None


class RecordResponse(BaseModel):
    id: int
    batch_id: int
    record_type: RecordType
    external_ref_no: str
    is_dirty: bool
    dirty_type: DirtyType
    dirty_note: Optional[str]
    is_processed: bool
    processing_note: Optional[str]
    product_name: Optional[str]
    quantity: Optional[float]
    unit_price: Optional[float]
    amount: Optional[float]
    record_date: Optional[datetime]
    supplier_name_in_record: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AttachmentResponse(BaseModel):
    id: int
    record_id: int
    file_name: str
    file_type: str
    file_size: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class StatusTrailResponse(BaseModel):
    id: int
    batch_id: int
    from_status: Optional[BatchStatus]
    to_status: BatchStatus
    changed_by: int
    changed_at: datetime
    reason: Optional[str]

    class Config:
        from_attributes = True


class CorrectionTrailResponse(BaseModel):
    id: int
    record_id: int
    field_name: str
    old_value: Optional[str]
    new_value: str
    corrected_by: int
    corrected_at: datetime
    correction_note: Optional[str]

    class Config:
        from_attributes = True


class StatusChangeRequest(BaseModel):
    reason: Optional[str] = None


class DirtyRecordAnalysis(BaseModel):
    record_id: int
    dirty_type: DirtyType
    dirty_note: str
    conflicts: Dict[str, Any] = {}


class ExportRow(BaseModel):
    batch_no: str
    supplier_name: str
    delivery_date: str
    status_before_freeze: str
    status_after_freeze: str
    bad_fruit_deduction: float
    secondary_sorting_loss: float
    duplicate_calculation_warning: str
    final_settlement: float
    manual_reason: str
    record_count: int
    dirty_record_count: int
    created_at: str


class BatchExportResponse(BaseModel):
    data: List[ExportRow]
    export_time: str
    total_count: int
