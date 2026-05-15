from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any


class RuleVersionBase(BaseModel):
    version: str
    rule_content: Dict[str, Any]
    description: str
    created_by: str


class RuleVersionCreate(RuleVersionBase):
    pass


class RuleVersionResponse(RuleVersionBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    batch_no: str
    name: str
    rule_version: str
    operator: str
    source_type: str


class BatchCreate(BatchBase):
    pass


class BatchResponse(BatchBase):
    id: int
    status: str
    total_count: int
    abnormal_count: int
    summary: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BusReservationBase(BaseModel):
    batch_no: str
    reservation_id: str
    employee_id: str
    employee_name: str
    department: str
    bus_route: str
    reservation_date: str
    time_slot: str
    status: str


class BusReservationCreate(BusReservationBase):
    submit_time: datetime
    is_duplicate: bool = False
    raw_data: Optional[Dict[str, Any]] = None


class BusReservationResponse(BusReservationBase):
    id: int
    submit_time: datetime
    is_duplicate: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ComparisonResultBase(BaseModel):
    batch_no: str
    record_id: str
    risk_type: str


class ComparisonResultCreate(ComparisonResultBase):
    is_abnormal: bool = False
    is_success: bool = True
    original_response: Optional[Dict[str, Any]] = None
    replay_response: Optional[Dict[str, Any]] = None
    diff_fields: Optional[List[str]] = None
    before_value: Optional[str] = None
    after_value: Optional[str] = None
    correction: Optional[str] = None
    conclusion: Optional[str] = None
    operator: str
    remark: Optional[str] = None


class ComparisonResultResponse(ComparisonResultBase):
    id: int
    is_abnormal: bool
    is_success: bool
    diff_fields: Optional[List[str]]
    before_value: Optional[str]
    after_value: Optional[str]
    correction: Optional[str]
    conclusion: Optional[str]
    operator: str
    remark: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CandidateListBase(BaseModel):
    batch_no: str
    candidate_type: str
    record_ids: List[str]
    reason: str
    operator: str


class CandidateListCreate(CandidateListBase):
    pass


class CandidateListResponse(CandidateListBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DiffReportResponse(BaseModel):
    batch_no: str
    record_id: str
    risk_type: str
    is_abnormal: bool
    key_fields_original: Dict[str, Any]
    key_fields_replay: Dict[str, Any]
    diff_fields: List[str]
    summary: str


class QueryFilter(BaseModel):
    batch_no: Optional[str] = None
    operator: Optional[str] = None
    risk_type: Optional[str] = None
    is_abnormal: Optional[bool] = None
    page: int = 1
    page_size: int = 20


class GenerateDataRequest(BaseModel):
    batch_no: str
    operator: str
    record_count: int = 10
