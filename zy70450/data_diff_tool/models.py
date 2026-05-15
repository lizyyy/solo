from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class FieldSource(BaseModel):
    field_path: str
    source: str
    source_type: str
    processing_rule: Optional[str] = None
    raw_value: Any
    processed_value: Any


class RepairOrder(BaseModel):
    order_id: str
    source_system: str
    report_date: str
    created_at: datetime
    repair_type: str
    building: str
    room: str
    description: str
    status: str
    assignee: Optional[str] = None
    completed_at: Optional[datetime] = None
    raw_data: Dict[str, Any]
    field_sources: List[FieldSource] = Field(default_factory=list)


class DiffItem(BaseModel):
    field_path: str
    old_value: Any
    new_value: Any
    source_old: str
    source_new: str
    change_type: str


class FailedRecord(BaseModel):
    record_id: str
    order_id: Optional[str] = None
    error_type: str
    error_message: str
    input_data: Dict[str, Any]
    field_sources: List[FieldSource] = Field(default_factory=list)
    failed_at: datetime = Field(default_factory=datetime.now)
    suggestion: Optional[str] = None


class ImportResult(BaseModel):
    batch_id: str
    total_records: int
    success_count: int
    failed_count: int
    diff_count: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    failed_records: List[FailedRecord] = Field(default_factory=list)
    diff_records: List[Dict[str, Any]] = Field(default_factory=list)


class ManualCorrection(BaseModel):
    correction_id: str
    order_id: str
    field_path: str
    old_value: Any
    new_value: Any
    reason: str
    source: str
    processing_basis: str
    corrected_at: datetime = Field(default_factory=datetime.now)
    is_gray_release: bool = False
