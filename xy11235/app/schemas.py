from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from .models import UserRole, ReagentHazardLevel, RecordStatus, ExceptionType


class UserBase(BaseModel):
    name: str
    employee_id: str
    role: UserRole
    department: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReagentBase(BaseModel):
    name: str
    cas_number: Optional[str] = None
    specification: Optional[str] = None
    hazard_level: ReagentHazardLevel
    total_stock: float = Field(ge=0)
    available_stock: float = Field(ge=0)
    unit: str
    manufacturer: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    location: Optional[str] = None


class ReagentCreate(ReagentBase):
    pass


class ReagentUpdate(BaseModel):
    name: Optional[str] = None
    cas_number: Optional[str] = None
    specification: Optional[str] = None
    hazard_level: Optional[ReagentHazardLevel] = None
    total_stock: Optional[float] = Field(None, ge=0)
    available_stock: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = None
    manufacturer: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    location: Optional[str] = None


class Reagent(ReagentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReagentRecordBase(BaseModel):
    reagent_id: int
    quantity: float = Field(gt=0)
    recipient_id: int
    purpose: Optional[str] = None


class ReagentRecordCreate(ReagentRecordBase):
    created_by_id: int


class ReagentRecordBatchCreate(BaseModel):
    records: List[ReagentRecordBase]
    created_by_id: int


class ReagentRecordApprove(BaseModel):
    approved_by_id: int
    approved: bool
    reject_reason: Optional[str] = None


class ReagentRecordBatchApprove(BaseModel):
    record_ids: List[int]
    approved_by_id: int
    approved: bool
    reject_reason: Optional[str] = None


class ReagentRecordDispense(BaseModel):
    dispensed_by_id: int


class ReagentRecord(ReagentRecordBase):
    id: int
    status: RecordStatus
    exception_type: ExceptionType
    exception_message: Optional[str] = None
    created_by_id: int
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    dispensed_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None
    batch_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    reagent: Optional[Reagent] = None
    creator: Optional[User] = None
    approver: Optional[User] = None
    recipient: Optional[User] = None

    class Config:
        from_attributes = True


class BatchOperationResult(BaseModel):
    batch_id: str
    total_count: int
    success_count: int
    failed_count: int
    status: str
    success_ids: List[int]
    failed_items: List[dict]


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    data: List[ReagentRecord]


class ExceptionSummary(BaseModel):
    exception_type: ExceptionType
    count: int


class StatusSummary(BaseModel):
    status: RecordStatus
    count: int
