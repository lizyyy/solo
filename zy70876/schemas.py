from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class AdvisorBase(BaseModel):
    advisor_id: str
    name: str
    department: str
    major: str
    research_direction: Optional[str] = None
    total_quota: int = 0


class AdvisorCreate(AdvisorBase):
    pass


class AdvisorUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    major: Optional[str] = None
    research_direction: Optional[str] = None
    total_quota: Optional[int] = None


class Advisor(AdvisorBase):
    id: int
    used_quota: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class StudentBase(BaseModel):
    student_id: str
    name: str
    department: str
    major: str
    exam_score: Optional[float] = None


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    major: Optional[str] = None
    exam_score: Optional[float] = None
    status: Optional[str] = None


class Student(StudentBase):
    id: int
    status: str
    advisor_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class PreferenceBase(BaseModel):
    student_id: int
    advisor_id: int
    priority: int


class PreferenceCreate(PreferenceBase):
    pass


class Preference(PreferenceBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class BatchBase(BaseModel):
    batch_code: str
    batch_name: str
    batch_type: str
    created_by: str


class BatchCreate(BatchBase):
    pass


class BatchUpdate(BaseModel):
    batch_name: Optional[str] = None
    status: Optional[str] = None


class Batch(BatchBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class AdjustmentRecordBase(BaseModel):
    student_id: int
    from_advisor_id: Optional[int] = None
    to_advisor_id: int
    reason: str
    created_by: str


class AdjustmentRecordCreate(AdjustmentRecordBase):
    batch_id: int


class AdjustmentRecordUpdate(BaseModel):
    status: Optional[str] = None
    reason: Optional[str] = None


class AdjustmentRecord(AdjustmentRecordBase):
    id: int
    batch_id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class AllocationRecordBase(BaseModel):
    student_id: int
    advisor_id: int
    batch_id: int
    allocation_type: str
    created_by: str


class AllocationRecordCreate(AllocationRecordBase):
    pass


class AllocationRecordUpdate(BaseModel):
    status: Optional[str] = None


class AllocationRecord(AllocationRecordBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class AuditLogBase(BaseModel):
    allocation_id: int
    action: str
    reason: str
    operator: str
    previous_status: str
    new_status: str


class AuditLogCreate(AuditLogBase):
    pass


class AuditLog(AuditLogBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class AllocationDetail(AllocationRecord):
    student: Student
    advisor: Advisor
    batch: Batch
    audit_logs: List[AuditLog]


class StudentPreference(BaseModel):
    student_id: str
    student_name: str
    preferences: List[dict]


class ValidationResult(BaseModel):
    valid: bool
    message: str
    error_type: Optional[str] = None


class ExportRequest(BaseModel):
    advisor_id: Optional[int] = None
    student_id: Optional[int] = None
    batch_id: Optional[int] = None
    status: Optional[str] = None
    research_direction: Optional[str] = None
    major: Optional[str] = None


class ProcessRequest(BaseModel):
    status: str
    reason: str
    operator: str
