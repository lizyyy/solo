from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List
from app.models import CertificateStatus, RetakeStatus, RenewalStatus


class EmployeeBase(BaseModel):
    employee_id: str = Field(..., description="员工编号")
    name: str = Field(..., description="员工姓名")
    department: Optional[str] = Field(None, description="部门")
    position: Optional[str] = Field(None, description="岗位")
    email: Optional[str] = Field(None, description="邮箱")
    phone: Optional[str] = Field(None, description="电话")


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class Employee(EmployeeBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CertificateTypeBase(BaseModel):
    type_code: str = Field(..., description="证书类型编码")
    name: str = Field(..., description="证书名称")
    description: Optional[str] = None
    validity_period_months: Optional[int] = Field(None, description="有效期（月）")
    required_score: float = Field(60.0, description="要求分数")


class CertificateTypeCreate(CertificateTypeBase):
    pass


class CertificateType(CertificateTypeBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EmployeeCertificateBase(BaseModel):
    employee_id: int
    certificate_type_id: int
    certificate_number: Optional[str] = None
    issue_date: date
    expiry_date: Optional[date] = None
    score: Optional[float] = None


class EmployeeCertificateCreate(EmployeeCertificateBase):
    pass


class EmployeeCertificateUpdate(BaseModel):
    certificate_number: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    score: Optional[float] = None
    is_valid: Optional[bool] = None


class EmployeeCertificate(EmployeeCertificateBase):
    id: int
    is_valid: bool
    status: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CourseScoreBase(BaseModel):
    employee_id: int
    certificate_type_id: int
    course_name: str
    score: float
    exam_date: date
    remarks: Optional[str] = None


class CourseScoreCreate(CourseScoreBase):
    pass


class CourseScore(CourseScoreBase):
    id: int
    is_passed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RetakeRecordBase(BaseModel):
    employee_id: int
    course_score_id: int
    retake_count: int = 1
    retake_date: Optional[date] = None
    retake_score: Optional[float] = None
    remarks: Optional[str] = None


class RetakeRecordCreate(RetakeRecordBase):
    pass


class RetakeRecordUpdate(BaseModel):
    retake_date: Optional[date] = None
    retake_score: Optional[float] = None
    status: Optional[RetakeStatus] = None
    is_passed: Optional[bool] = None
    remarks: Optional[str] = None


class RetakeRecord(RetakeRecordBase):
    id: int
    status: str
    is_passed: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PositionRequirementBase(BaseModel):
    position_name: str
    certificate_type_id: int
    is_required: bool = True
    description: Optional[str] = None


class PositionRequirementCreate(PositionRequirementBase):
    pass


class PositionRequirement(PositionRequirementBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PositionQualificationBase(BaseModel):
    employee_id: int
    position_name: str
    certificate_type_id: int
    is_qualified: bool = False
    qualification_date: Optional[date] = None
    remarks: Optional[str] = None


class PositionQualificationCreate(PositionQualificationBase):
    pass


class PositionQualificationUpdate(BaseModel):
    is_qualified: Optional[bool] = None
    qualification_date: Optional[date] = None
    remarks: Optional[str] = None


class PositionQualification(PositionQualificationBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class RenewalItemBase(BaseModel):
    employee_id: int
    certificate_type_id: int
    employee_certificate_id: Optional[int] = None
    priority: int = 1
    due_date: Optional[date] = None
    assigned_to: Optional[str] = None
    remarks: Optional[str] = None


class RenewalItemCreate(RenewalItemBase):
    pass


class RenewalItemUpdate(BaseModel):
    status: Optional[RenewalStatus] = None
    priority: Optional[int] = None
    due_date: Optional[date] = None
    assigned_to: Optional[str] = None
    remarks: Optional[str] = None


class ManualCorrection(BaseModel):
    handler: str = Field(..., description="处理人")
    conclusion: str = Field(..., description="处理结论")
    new_status: Optional[RenewalStatus] = None
    remarks: Optional[str] = None


class RenewalItem(RenewalItemBase):
    id: int
    renewal_code: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ExceptionLogBase(BaseModel):
    operation_type: str
    original_input: str
    handler: Optional[str] = None
    conclusion: Optional[str] = None
    error_message: Optional[str] = None


class ExceptionLogCreate(ExceptionLogBase):
    pass


class ExceptionLog(ExceptionLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class QualificationCheckResult(BaseModel):
    employee_id: str
    employee_name: str
    position_name: str
    certificate_type: str
    has_certificate: bool
    is_certificate_valid: bool
    certificate_status: Optional[str]
    has_required_score: bool
    is_qualified: bool
    remarks: str


class RenewalStatistics(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    cancelled: int
    closed: int


class CertificateExpiryAlert(BaseModel):
    employee_id: str
    employee_name: str
    certificate_type: str
    certificate_number: Optional[str]
    expiry_date: Optional[date]
    days_until_expiry: Optional[int]
    status: str
