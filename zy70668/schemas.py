from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class StudentBase(BaseModel):
    student_id: str = Field(..., max_length=20)
    name: str = Field(..., max_length=50)
    grade: Optional[str] = Field(None, max_length=20)
    major: Optional[str] = Field(None, max_length=50)


class StudentCreate(StudentBase):
    pass


class Student(StudentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ActivityTypeBase(BaseModel):
    code: str = Field(..., max_length=20)
    name: str = Field(..., max_length=50)
    max_credit: float
    description: Optional[str] = None


class ActivityTypeCreate(ActivityTypeBase):
    pass


class ActivityType(ActivityTypeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RejectionReasonBase(BaseModel):
    reason: str
    handler: str
    original_input: Optional[str] = None
    conclusion: Optional[str] = None


class RejectionReasonCreate(RejectionReasonBase):
    application_id: int


class RejectionReason(RejectionReasonBase):
    id: int
    handled_at: datetime

    class Config:
        from_attributes = True


class CreditApplicationBase(BaseModel):
    activity_name: str = Field(..., max_length=100)
    activity_date: Optional[datetime] = None
    credit: float
    proof_material: Optional[str] = None


class CreditApplicationCreate(CreditApplicationBase):
    student_id: str
    activity_type_code: str


class CreditApplicationUpdate(BaseModel):
    activity_name: Optional[str] = None
    credit: Optional[float] = None
    proof_material: Optional[str] = None


class CreditApplication(CreditApplicationBase):
    id: int
    student_id: int
    activity_type_id: int
    status: str
    is_duplicate: bool
    duplicate_of: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    rejection: Optional[RejectionReason] = None

    class Config:
        from_attributes = True


class CreditApplicationDetail(CreditApplication):
    student: Student
    activity_type: ActivityType


class ReportDetailBase(BaseModel):
    activity_type_id: int
    activity_name: str
    credit: float
    status: str
    rejection_reason: Optional[str] = None


class ReportDetail(ReportDetailBase):
    id: int

    class Config:
        from_attributes = True


class CreditReportBase(BaseModel):
    pass


class CreditReportCreate(BaseModel):
    student_id: str
    generated_by: str


class CreditReport(CreditReportBase):
    id: int
    student_id: int
    report_date: datetime
    lecture_credit: float
    competition_credit: float
    volunteer_credit: float
    total_credit: float
    status: str
    generated_by: Optional[str]
    details: List[ReportDetail] = []

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    handler: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    comment: Optional[str] = None
    original_data: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    application_id: int


class AuditLog(AuditLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    new_status: str
    handler: str
    comment: Optional[str] = None
    rejection_reason: Optional[str] = None


class ManualCorrection(BaseModel):
    new_credit: float
    handler: str
    comment: str
    original_input: str


class StudentCreditSummary(BaseModel):
    student_id: str
    student_name: str
    lecture_credit: float
    lecture_max: float
    competition_credit: float
    competition_max: float
    volunteer_credit: float
    volunteer_max: float
    total_credit: float
    total_max: float
    pending_count: int
    approved_count: int
    rejected_count: int
