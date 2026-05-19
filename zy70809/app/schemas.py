from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List
from app.models import ResultType, RuleType, BatchStatus

class BatchBase(BaseModel):
    batch_no: str

class BatchCreate(BatchBase):
    pass

class Batch(BatchBase):
    id: int
    equipment_file: Optional[str]
    photo_file: Optional[str]
    contract_file: Optional[str]
    status: BatchStatus
    created_at: datetime
    processed_at: Optional[datetime]

    class Config:
        orm_mode = True

class ValidationResultBase(BaseModel):
    equipment_code: str
    result_type: ResultType
    rule_type: Optional[RuleType]
    original_data: Optional[str]
    suggestion: Optional[str]

class ValidationResultCreate(ValidationResultBase):
    batch_id: int

class ValidationResult(ValidationResultBase):
    id: int
    batch_id: int
    created_at: datetime

    class Config:
        orm_mode = True

class BatchProcessResponse(BaseModel):
    batch_no: str
    status: BatchStatus
    normal_count: int
    pending_confirm_count: int
    failed_count: int
    normal_items: List[dict]
    pending_confirm_items: List[ValidationResult]
    failed_items: List[ValidationResult]

class EquipmentTraceResponse(BaseModel):
    equipment_code: str
    equipment_name: str
    maintenance_dates: List[dict]
    contracts: List[dict]
    photos: List[dict]
    validation_history: List[dict]
    final_report: Optional[dict]
