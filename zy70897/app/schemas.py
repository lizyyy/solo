from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any


class HandoverRecordBase(BaseModel):
    handover_date: str
    branch_code: str
    branch_name: str
    teller_from: str
    teller_to: str
    cashbox_number: str
    system_amount: float
    actual_amount: float
    difference: float
    confirmer_1: str
    confirmer_2: str
    handover_time: str


class HandoverRecordResponse(HandoverRecordBase):
    id: int
    batch_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorRecordBase(BaseModel):
    error_code: str
    error_type: str
    error_description: str
    suggestion: str
    original_data: str
    is_closed: bool = False


class ErrorRecordResponse(ErrorRecordBase):
    id: int
    batch_id: int
    handover_record_id: Optional[int]
    created_at: datetime
    closed_at: Optional[datetime]

    class Config:
        from_attributes = True


class BatchResponse(BaseModel):
    id: int
    batch_number: str
    submitted_at: datetime
    total_records: int
    status: str

    class Config:
        from_attributes = True


class ProcessingResult(BaseModel):
    batch_number: str
    normal_items: List[HandoverRecordResponse]
    pending_items: List[HandoverRecordResponse]
    failed_items: List[Dict[str, Any]]
    statistics: Dict[str, int]


class ErrorTraceResponse(BaseModel):
    error_code: str
    error_type: str
    error_description: str
    created_at: datetime
    is_closed: bool
    original_data: Dict[str, Any]
    suggestion: str
    batch_info: Optional[BatchResponse]
    handover_info: Optional[HandoverRecordResponse]
