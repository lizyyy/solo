from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TaskBase(BaseModel):
    task_name: str
    source_teacher: str
    remark: Optional[str] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    status: Optional[str] = None
    handler: Optional[str] = None
    remark: Optional[str] = None


class Task(TaskBase):
    id: int
    status: str
    total_records: int
    valid_records: int
    exception_records: int
    duplicate_records: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RawRecordBase(BaseModel):
    task_id: int
    row_number: int
    original_data: str
    source_file: str


class RawRecordCreate(RawRecordBase):
    pass


class RawRecord(RawRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CleanedRecordBase(BaseModel):
    student_name: Optional[str] = None
    passport_number: Optional[str] = None
    id_card_number: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[str] = None
    school: Optional[str] = None
    grade: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_relation: Optional[str] = None
    guardian_email: Optional[str] = None
    diet_restriction: Optional[str] = None
    special_needs: Optional[str] = None


class CleanedRecordCreate(CleanedRecordBase):
    task_id: int
    raw_record_id: int


class CleanedRecordUpdate(BaseModel):
    student_name: Optional[str] = None
    passport_number: Optional[str] = None
    id_card_number: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_relation: Optional[str] = None
    diet_restriction: Optional[str] = None
    handler: str
    conclusion: str


class CleanedRecord(CleanedRecordBase):
    id: int
    task_id: int
    raw_record_id: int
    status: str
    is_duplicate: bool
    duplicate_with: Optional[int] = None
    exception_reason: Optional[str] = None
    is_manual_corrected: bool
    last_handler: Optional[str] = None
    last_conclusion: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GuardianBase(BaseModel):
    name: str
    phone: str
    relation: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = True


class GuardianCreate(GuardianBase):
    cleaned_record_id: int


class Guardian(GuardianBase):
    id: int
    cleaned_record_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DietRestrictionBase(BaseModel):
    restriction_type: str
    description: str
    severity: Optional[str] = "mild"


class DietRestrictionCreate(DietRestrictionBase):
    cleaned_record_id: int


class DietRestriction(DietRestrictionBase):
    id: int
    cleaned_record_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CleanReportBase(BaseModel):
    task_id: int
    report_type: str
    content: str
    generated_by: Optional[str] = None


class CleanReportCreate(CleanReportBase):
    pass


class CleanReport(CleanReportBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    handler: str
    conclusion: Optional[str] = None
    original_value: Optional[str] = None
    new_value: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    cleaned_record_id: Optional[int] = None
    task_id: Optional[int] = None


class AuditLog(AuditLogBase):
    id: int
    cleaned_record_id: Optional[int] = None
    task_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class HeaderMappingBase(BaseModel):
    source_teacher: str
    source_header: str
    standard_field: str


class HeaderMappingCreate(HeaderMappingBase):
    pass


class HeaderMapping(HeaderMappingBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MergeRequest(BaseModel):
    keep_record_id: int
    merge_record_ids: List[int]
    handler: str
    conclusion: Optional[str] = None


class TaskDetail(Task):
    raw_records: List[RawRecord] = []
    cleaned_records: List[CleanedRecord] = []
    reports: List[CleanReport] = []


class CleanedRecordDetail(CleanedRecord):
    raw_record: Optional[RawRecord] = None
    guardians: List[Guardian] = []
    diet_restrictions: List[DietRestriction] = []
    audit_logs: List[AuditLog] = []


class CleaningResult(BaseModel):
    task_id: int
    total_processed: int
    valid_count: int
    exception_count: int
    duplicate_count: int
    exceptions: List[Dict[str, Any]] = []
    duplicates: List[Dict[str, Any]] = []
