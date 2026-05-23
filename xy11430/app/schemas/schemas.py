from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

from app.models.models import UserRole, ReceiptStatus, AbnormalType, DataSource


class UserBase(BaseModel):
    username: str
    real_name: str
    role: UserRole
    college: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class BatchBase(BaseModel):
    batch_no: str
    name: str
    description: Optional[str] = None
    college: str


class BatchCreate(BatchBase):
    pass


class BatchResponse(BatchBase):
    id: int
    status: str
    is_frozen: bool
    frozen_reason: Optional[str] = None
    frozen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RequisitionBase(BaseModel):
    requisition_no: str
    college: str
    lab_name: Optional[str] = None
    teacher_name: Optional[str] = None
    material_name: str
    material_code: Optional[str] = None
    specification: Optional[str] = None
    quantity: float
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    requisition_date: Optional[datetime] = None
    purpose: Optional[str] = None
    is_abnormal: bool = False
    abnormal_type: Optional[AbnormalType] = None
    abnormal_reason: Optional[str] = None


class RequisitionCreate(RequisitionBase):
    batch_id: Optional[int] = None
    idempotent_key: Optional[str] = None


class RequisitionResponse(RequisitionBase):
    id: int
    batch_id: Optional[int] = None
    source: DataSource
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PurchaseArrivalBase(BaseModel):
    arrival_no: str
    college: str
    supplier_name: Optional[str] = None
    material_name: str
    material_code: Optional[str] = None
    specification: Optional[str] = None
    ordered_quantity: Optional[float] = None
    arrived_quantity: float
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    arrival_date: Optional[datetime] = None
    quality_status: Optional[str] = None
    is_abnormal: bool = False
    abnormal_type: Optional[AbnormalType] = None
    abnormal_reason: Optional[str] = None


class PurchaseArrivalCreate(PurchaseArrivalBase):
    batch_id: Optional[int] = None
    idempotent_key: Optional[str] = None


class PurchaseArrivalResponse(PurchaseArrivalBase):
    id: int
    batch_id: Optional[int] = None
    source: DataSource
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TeacherSignBase(BaseModel):
    sign_no: str
    college: str
    teacher_name: str
    lab_name: Optional[str] = None
    material_name: str
    material_code: Optional[str] = None
    specification: Optional[str] = None
    quantity: float
    unit: Optional[str] = None
    sign_date: Optional[datetime] = None
    original_requisition_no: Optional[str] = None
    is_abnormal: bool = False
    abnormal_type: Optional[AbnormalType] = None
    abnormal_reason: Optional[str] = None


class TeacherSignCreate(TeacherSignBase):
    batch_id: Optional[int] = None
    idempotent_key: Optional[str] = None


class TeacherSignResponse(TeacherSignBase):
    id: int
    batch_id: Optional[int] = None
    source: DataSource
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SupplierStatementBase(BaseModel):
    statement_no: str
    college: str
    supplier_name: str
    material_name: str
    material_code: Optional[str] = None
    specification: Optional[str] = None
    statement_quantity: float
    actual_quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    statement_date: Optional[datetime] = None
    is_abnormal: bool = False
    abnormal_type: Optional[AbnormalType] = None
    abnormal_reason: Optional[str] = None


class SupplierStatementCreate(SupplierStatementBase):
    batch_id: Optional[int] = None
    idempotent_key: Optional[str] = None


class SupplierStatementResponse(SupplierStatementBase):
    id: int
    batch_id: Optional[int] = None
    source: DataSource
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AbnormalReceiptBase(BaseModel):
    receipt_no: str
    college: str
    abnormal_type: AbnormalType
    source_type: DataSource
    source_no: Optional[str] = None
    material_name: str
    material_code: Optional[str] = None
    specification: Optional[str] = None
    quantity: float
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    lab_name: Optional[str] = None
    teacher_name: Optional[str] = None
    supplier_name: Optional[str] = None
    abnormal_reason: Optional[str] = None
    manual_reason: Optional[str] = None
    approval_email_content: Optional[str] = None


class AbnormalReceiptCreate(AbnormalReceiptBase):
    batch_id: Optional[int] = None
    source_id: Optional[int] = None
    idempotent_key: Optional[str] = None


class AbnormalReceiptResponse(AbnormalReceiptBase):
    id: int
    batch_id: Optional[int] = None
    source_id: Optional[int] = None
    status: ReceiptStatus
    previous_status: Optional[ReceiptStatus] = None
    frozen_before_status: Optional[ReceiptStatus] = None
    is_archived: bool
    review_comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StatusChangeRequest(BaseModel):
    receipt_id: int
    change_reason: Optional[str] = None
    manual_reason: Optional[str] = None


class StatusHistoryResponse(BaseModel):
    id: int
    receipt_id: int
    from_status: Optional[ReceiptStatus] = None
    to_status: ReceiptStatus
    change_reason: Optional[str] = None
    manual_reason: Optional[str] = None
    created_at: datetime
    changer_name: Optional[str] = None

    class Config:
        from_attributes = True


class FailedRecordResponse(BaseModel):
    id: int
    source_type: DataSource
    batch_id: Optional[int] = None
    raw_data: str
    error_message: str
    error_type: Optional[str] = None
    retry_count: int
    resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success_count: int
    failed_count: int
    updated_count: int
    failed_records: List[FailedRecordResponse] = []


class BatchSummary(BaseModel):
    batch_id: int
    batch_no: str
    college: str
    total_receipts: int
    total_amount: float
    by_status: Dict[str, int]
    by_abnormal_type: Dict[str, int]
    frozen_before_status: Optional[str] = None
    is_frozen: bool


class ExportRequest(BaseModel):
    batch_id: Optional[int] = None
    college: Optional[str] = None
    status: Optional[List[ReceiptStatus]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    include_history: bool = False


class IdempotentRequest(BaseModel):
    idempotent_key: str
    data: Dict[str, Any]
