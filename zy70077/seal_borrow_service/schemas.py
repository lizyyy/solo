from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from .models import (
    SealType, SealStatus, ApplicationStatus, ReturnVerificationResult,
    TimeoutLevel, StatusCorrectionType, FinalResult
)


class SealBase(BaseModel):
    seal_code: str
    seal_name: str
    seal_type: SealType
    description: Optional[str] = None
    custodian: Optional[str] = None
    department: Optional[str] = None


class SealCreate(SealBase):
    pass


class SealUpdate(BaseModel):
    seal_name: Optional[str] = None
    seal_type: Optional[SealType] = None
    description: Optional[str] = None
    status: Optional[SealStatus] = None
    custodian: Optional[str] = None
    department: Optional[str] = None


class SealResponse(SealBase):
    id: int
    status: SealStatus
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BorrowApplicationBase(BaseModel):
    seal_id: int
    applicant_id: str
    applicant_name: str
    applicant_department: Optional[str] = None
    borrow_reason: str
    borrow_location: Optional[str] = None
    planned_borrow_date: datetime
    planned_return_date: datetime


class BorrowApplicationCreate(BorrowApplicationBase):
    pass


class BorrowApplicationUpdate(BaseModel):
    borrow_reason: Optional[str] = None
    borrow_location: Optional[str] = None
    planned_borrow_date: Optional[datetime] = None
    planned_return_date: Optional[datetime] = None


class BorrowApplicationResponse(BorrowApplicationBase):
    id: int
    application_no: str
    status: ApplicationStatus
    current_timeout_level: Optional[TimeoutLevel] = None
    final_result: Optional[FinalResult] = None
    approval_person: Optional[str] = None
    approval_opinion: Optional[str] = None
    approval_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BorrowRecordBase(BaseModel):
    actual_borrow_date: datetime = Field(default_factory=datetime.now)
    borrower_signature: Optional[str] = None
    custodian_signature: Optional[str] = None
    borrow_remarks: Optional[str] = None


class BorrowRecordResponse(BorrowRecordBase):
    id: int
    application_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UsageMaterialBase(BaseModel):
    material_type: str
    material_name: str
    file_path: str
    file_size: Optional[int] = None
    material_description: Optional[str] = None


class UsageMaterialCreate(UsageMaterialBase):
    uploader: Optional[str] = None


class UsageMaterialResponse(UsageMaterialBase):
    id: int
    application_id: int
    upload_time: datetime
    uploader: Optional[str] = None
    is_verified: bool
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_remarks: Optional[str] = None

    class Config:
        from_attributes = True


class ReturnRecordBase(BaseModel):
    actual_return_date: datetime = Field(default_factory=datetime.now)
    verification_result: ReturnVerificationResult
    verification_details: Optional[str] = None
    verifier: str
    returned_by: Optional[str] = None
    return_remarks: Optional[str] = None
    materials_complete: bool = True
    seal_intact: bool = True


class ReturnRecordResponse(ReturnRecordBase):
    id: int
    application_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TimeoutRecordResponse(BaseModel):
    id: int
    application_id: int
    timeout_level: TimeoutLevel
    detected_at: datetime
    overdue_hours: float
    escalated_to: Optional[str] = None
    escalation_message: Optional[str] = None
    is_handled: bool
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None
    handling_result: Optional[str] = None

    class Config:
        from_attributes = True


class StatusHistoryResponse(BaseModel):
    id: int
    application_id: int
    previous_status: Optional[ApplicationStatus] = None
    new_status: ApplicationStatus
    previous_timeout_level: Optional[TimeoutLevel] = None
    new_timeout_level: Optional[TimeoutLevel] = None
    correction_type: StatusCorrectionType
    operator: str
    operation_reason: Optional[str] = None
    operation_time: datetime
    affected_fields: Optional[List[str]] = None

    class Config:
        from_attributes = True


class ManualCorrectionRequest(BaseModel):
    new_status: ApplicationStatus
    new_timeout_level: Optional[TimeoutLevel] = None
    operator: str
    reason: str


class TimeoutHandleRequest(BaseModel):
    handled_by: str
    handling_result: str


class ApprovalRequest(BaseModel):
    approval_person: str
    approval_opinion: Optional[str] = None
    approve: bool


class BusinessResponse(BaseModel):
    success: bool
    business_code: str
    message: str
    data: Optional[dict] = None


class ApplicationDetailResponse(BorrowApplicationResponse):
    seal: SealResponse
    borrow_record: Optional[BorrowRecordResponse] = None
    usage_materials: List[UsageMaterialResponse] = []
    return_record: Optional[ReturnRecordResponse] = None
    timeout_records: List[TimeoutRecordResponse] = []
    status_histories: List[StatusHistoryResponse] = []


class StatisticsSummary(BaseModel):
    total_applications: int
    pending_approval: int
    lended: int
    returned: int
    timeout: int
    materials_missing: int
    normal_completion: int
    timeout_level1: int
    timeout_level2: int
    timeout_level3: int
    timeout_level4: int


class MonthlyReportItem(BaseModel):
    month: str
    total_applications: int
    normal_completion: int
    materials_incomplete: int
    timeout_serious: int
    abnormal_return: int
    average_borrow_days: float
    materials_upload_rate: float
