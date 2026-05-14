from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class EvaluationFragmentBase(BaseModel):
    batch_number: str
    source_system: str
    model_name: str
    task_type: Optional[str] = None
    original_input: Dict[str, Any]
    response_data: Dict[str, Any]
    handler: Optional[str] = None
    department: Optional[str] = None


class EvaluationFragmentCreate(EvaluationFragmentBase):
    pass


class EvaluationFragment(EvaluationFragmentBase):
    id: int
    submitted_at: datetime
    processed: bool
    has_error: bool
    error_type: Optional[str] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class ProcessingRecordBase(BaseModel):
    fragment_id: int
    handler: str
    action: str
    result: str
    notes: Optional[str] = None


class ProcessingRecordCreate(ProcessingRecordBase):
    pass


class ProcessingRecord(ProcessingRecordBase):
    id: int
    processed_at: datetime

    class Config:
        from_attributes = True


class FieldTraceBase(BaseModel):
    fragment_id: int
    field_path: str
    original_value: Optional[str] = None
    trimmed_value: Optional[str] = None
    trim_reason: Optional[str] = None


class FieldTraceCreate(FieldTraceBase):
    pass


class FieldTrace(FieldTraceBase):
    id: int
    traced_at: datetime

    class Config:
        from_attributes = True


class ReportBase(BaseModel):
    report_name: str
    report_type: Optional[str] = None
    batch_number: Optional[str] = None
    total_records: int = 0
    error_count: int = 0
    conflict_count: int = 0
    content_summary: Optional[Dict[str, Any]] = None
    generated_by: Optional[str] = None


class ReportCreate(ReportBase):
    pass


class Report(ReportBase):
    id: int
    file_path: Optional[str] = None
    generated_at: datetime

    class Config:
        from_attributes = True


class BatchConflictBase(BaseModel):
    batch_number: str
    conflict_type: str
    fragment_ids: List[int]
    source_systems: List[str]
    description: Optional[str] = None


class BatchConflictCreate(BatchConflictBase):
    pass


class BatchConflict(BatchConflictBase):
    id: int
    resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    detected_at: datetime

    class Config:
        from_attributes = True


class TrimRequest(BaseModel):
    fragment_ids: List[int]
    fields_to_trim: List[str]
    trim_reason: str
    handler: str


class TrimResult(BaseModel):
    fragment_id: int
    success: bool
    trimmed_fields: List[str]
    message: Optional[str] = None


class ConflictResolution(BaseModel):
    conflict_id: int
    resolved_by: str
    resolution_notes: str
