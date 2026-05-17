from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List
from models import (
    EmployeeStatus, CertificateStatus, ExamStatus,
    RetakeStatus, RenewalStatus, QualificationMatch
)


class EmployeeBase(BaseModel):
    employee_id: str
    name: str
    department: Optional[str] = None
    position: Optional[str] = None
    status: EmployeeStatus = EmployeeStatus.ACTIVE
    hire_date: Optional[date] = None


class EmployeeCreate(EmployeeBase):
    pass


class Employee(EmployeeBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CertificateTypeBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    validity_period_months: Optional[int] = None
    required_courses: Optional[str] = None


class CertificateTypeCreate(CertificateTypeBase):
    pass


class CertificateType(CertificateTypeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class EmployeeCertificateBase(BaseModel):
    employee_id: int
    certificate_type_id: int
    certificate_number: Optional[str] = None
    issue_date: date
    expiry_date: date


class EmployeeCertificateCreate(EmployeeCertificateBase):
    pass


class EmployeeCertificate(EmployeeCertificateBase):
    id: int
    status: CertificateStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    certificate_type: CertificateType

    class Config:
        from_attributes = True


class CourseScoreBase(BaseModel):
    employee_id: int
    course_code: str
    course_name: str
    score: float
    exam_date: date


class CourseScoreCreate(CourseScoreBase):
    pass


class CourseScore(CourseScoreBase):
    id: int
    status: ExamStatus
    created_at: datetime

    class Config:
        from_attributes = True


class RetakeRecordBase(BaseModel):
    employee_id: int
    course_score_id: int
    attempt_number: int = 1
    scheduled_date: Optional[date] = None
    actual_date: Optional[date] = None
    score: Optional[float] = None
    notes: Optional[str] = None


class RetakeRecordCreate(RetakeRecordBase):
    pass


class RetakeRecordUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    actual_date: Optional[date] = None
    score: Optional[float] = None
    status: Optional[RetakeStatus] = None
    notes: Optional[str] = None


class RetakeRecord(RetakeRecordBase):
    id: int
    status: RetakeStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PositionRequirementBase(BaseModel):
    employee_id: int
    position_name: str
    required_certificate_types: Optional[str] = None
    required_courses: Optional[str] = None


class PositionRequirementCreate(PositionRequirementBase):
    pass


class PositionRequirement(PositionRequirementBase):
    id: int
    qualification_match: QualificationMatch
    match_details: Optional[str] = None
    evaluated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RenewalItemBase(BaseModel):
    employee_id: int
    employee_certificate_id: Optional[int] = None
    renewal_batch: str
    due_date: Optional[date] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class RenewalItemCreate(RenewalItemBase):
    pass


class RenewalItemUpdate(BaseModel):
    status: Optional[RenewalStatus] = None
    due_date: Optional[date] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class RenewalItem(RenewalItemBase):
    id: int
    status: RenewalStatus
    processed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    renewal_item_id: Optional[int] = None
    operation_type: str
    operator: str
    original_input: Optional[str] = None
    processing_result: Optional[str] = None
    conclusion: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLog(OperationLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ManualCorrectionRequest(BaseModel):
    operator: str
    original_status: str
    new_status: RenewalStatus
    reason: str
    notes: Optional[str] = None


class RenewalFilterParams(BaseModel):
    status: Optional[RenewalStatus] = None
    department: Optional[str] = None
    renewal_batch: Optional[str] = None
    employee_id: Optional[str] = None


class RenewalStatistics(BaseModel):
    total: int
    pending: int
    in_progress: int
    approved: int
    rejected: int
    expired_soon: int
    expired: int
