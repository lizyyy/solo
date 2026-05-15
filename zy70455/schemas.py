from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class DutyRecordCreate(BaseModel):
    batch_id: str
    duty_date: str
    department: str
    duty_person: str
    phone: str
    incident_count: int = 0
    incidents: List[Dict[str, Any]] = []
    external_receipt_status: str = "pending"
    raw_input: Dict[str, Any]


class DutyRecordResponse(BaseModel):
    id: int
    batch_id: str
    duty_date: str
    department: str
    duty_person: str
    phone: str
    incident_count: int
    incidents: List[Dict[str, Any]]
    external_receipt_status: str
    external_receipt_time: Optional[datetime] = None
    raw_input: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SamplingRuleCreate(BaseModel):
    version: str
    name: str
    description: str
    department: str
    sampling_rate: float
    min_incidents: int
    include_departments: List[str]
    exclude_departments: List[str] = []
    receipt_timeout_hours: int = 48
    created_by: str


class SamplingRuleResponse(BaseModel):
    id: int
    version: str
    name: str
    description: str
    department: str
    sampling_rate: float
    min_incidents: int
    include_departments: List[str]
    exclude_departments: List[str]
    receipt_timeout_hours: int
    is_active: bool
    created_at: datetime
    created_by: str

    class Config:
        from_attributes = True


class ProcessingBatchCreate(BaseModel):
    batch_id: str
    rule_version: str
    department: str
    start_date: str
    end_date: str
    created_by: str


class ProcessingBatchResponse(BaseModel):
    id: int
    batch_id: str
    rule_version: Optional[str] = None
    rule_snapshot: Optional[Dict[str, Any]] = None
    department: str
    start_date: str
    end_date: str
    total_records: int = 0
    sampled_count: int = 0
    status: str
    summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    created_by: str

    class Config:
        from_attributes = True


class OperationLogResponse(BaseModel):
    id: int
    operation_type: str
    batch_id: Optional[str] = None
    record_id: Optional[int] = None
    operator: str
    operation_time: datetime
    details: Dict[str, Any]
    status: str
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class CleanupCandidateCreate(BaseModel):
    operation_type: str
    batch_ids: List[str] = []
    record_ids: List[int] = []
    reason: str


class CleanupCandidateResponse(BaseModel):
    id: int
    candidate_id: str
    operation_type: str
    batch_ids: List[str]
    record_ids: List[int]
    reason: str
    summary: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    executed_by: Optional[str] = None
    executed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SamplingResultResponse(BaseModel):
    batch_id: str
    rule_version: str
    total_records: int
    sampled_count: int
    sampled_records: List[DutyRecordResponse]
    late_receipt_count: int
    rule_snapshot: Dict[str, Any]


class BatchQuery(BaseModel):
    batch_id: Optional[str] = None
    department: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None


class OperationLogQuery(BaseModel):
    operation_type: Optional[str] = None
    batch_id: Optional[str] = None
    operator: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
