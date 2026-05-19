from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from models import VerificationStatus, ExceptionType


class VisitorBase(BaseModel):
    name: str = Field(..., max_length=100)
    id_card: str = Field(..., max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    company: Optional[str] = Field(None, max_length=200)
    visit_purpose: Optional[str] = Field(None, max_length=500)
    host_name: Optional[str] = Field(None, max_length=100)
    host_department: Optional[str] = Field(None, max_length=100)
    expected_start: datetime
    expected_end: datetime
    license_plate: Optional[str] = Field(None, max_length=20)
    gate_number: Optional[str] = Field(None, max_length=10)
    responsible_person: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class VisitorCreate(VisitorBase):
    pass


class VisitorUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    visit_purpose: Optional[str] = None
    host_name: Optional[str] = None
    host_department: Optional[str] = None
    expected_start: Optional[datetime] = None
    expected_end: Optional[datetime] = None
    license_plate: Optional[str] = None
    gate_number: Optional[str] = None
    status: Optional[VerificationStatus] = None
    responsible_person: Optional[str] = None
    notes: Optional[str] = None


class Visitor(VisitorBase):
    id: int
    status: VerificationStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TemporaryPlateBase(BaseModel):
    plate_number: str = Field(..., max_length=20)
    visitor_id: Optional[int] = None
    issued_by: Optional[str] = Field(None, max_length=100)
    valid_from: datetime
    valid_to: datetime
    is_active: bool = True
    notes: Optional[str] = None


class TemporaryPlateCreate(TemporaryPlateBase):
    pass


class TemporaryPlate(TemporaryPlateBase):
    id: int
    issued_at: datetime

    class Config:
        from_attributes = True


class BlacklistBase(BaseModel):
    identifier: str = Field(..., max_length=100)
    identifier_type: str = Field(..., max_length=20)
    reason: str = Field(..., max_length=500)
    added_by: Optional[str] = Field(None, max_length=100)
    is_active: bool = True
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None


class BlacklistCreate(BlacklistBase):
    pass


class Blacklist(BlacklistBase):
    id: int
    added_at: datetime

    class Config:
        from_attributes = True


class VerificationRecordBase(BaseModel):
    visitor_id: Optional[int] = None
    plate_number: Optional[str] = Field(None, max_length=20)
    id_card: Optional[str] = Field(None, max_length=50)
    gate_number: Optional[str] = Field(None, max_length=10)
    verified_by: Optional[str] = Field(None, max_length=100)
    status: VerificationStatus
    exception_type: ExceptionType = ExceptionType.NO_EXCEPTION
    exception_details: Optional[str] = None
    notes: Optional[str] = None


class VerificationRecordCreate(VerificationRecordBase):
    pass


class VerificationRecord(VerificationRecordBase):
    id: int
    verified_at: datetime

    class Config:
        from_attributes = True


class VerificationRequest(BaseModel):
    plate_number: Optional[str] = None
    id_card: Optional[str] = None
    gate_number: Optional[str] = None
    verified_by: Optional[str] = None


class VerificationResponse(BaseModel):
    success: bool
    status: VerificationStatus
    exception_type: ExceptionType
    message: str
    visitor: Optional[Visitor] = None
    record_id: Optional[int] = None


class BatchResult(BaseModel):
    total: int
    success_count: int
    failure_count: int
    successful: List[dict]
    failed: List[dict]


class QueryFilters(BaseModel):
    responsible_person: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[VerificationStatus] = None
    exception_type: Optional[ExceptionType] = None
    gate_number: Optional[str] = None
