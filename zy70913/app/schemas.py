from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models import BatchStatus, GrievanceStatus, RuleLevel


class BatchBase(BaseModel):
    batch_no: str
    file_name: Optional[str] = None
    status: BatchStatus = BatchStatus.PENDING


class BatchCreate(BatchBase):
    file_hash: Optional[str] = None


class Batch(BatchBase):
    id: int
    file_hash: Optional[str] = None
    total_count: int = 0
    success_count: int = 0
    fail_count: int = 0
    pending_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BatchDetail(Batch):
    grievances: List["Grievance"] = []


class GrievanceBase(BaseModel):
    grievance_no: str
    passenger_name: Optional[str] = None
    passenger_id: Optional[str] = None
    flight_no: Optional[str] = None
    flight_date: Optional[datetime] = None
    incident_type: Optional[str] = None
    incident_desc: Optional[str] = None
    apply_amount: float = 0.0
    apply_time: Optional[datetime] = None


class GrievanceCreate(GrievanceBase):
    original_data: Optional[Dict[str, Any]] = None


class Grievance(GrievanceBase):
    id: int
    batch_id: int
    status: GrievanceStatus = GrievanceStatus.PENDING
    final_amount: float = 0.0
    rule_level: Optional[RuleLevel] = None
    photo_count: int = 0
    has_photo_evidence: bool = False
    is_overdue: bool = False
    is_responsible: bool = False
    remark: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GrievanceDetail(Grievance):
    flights: List["Flight"] = []
    photo_indices: List["PhotoIndex"] = []
    processing_histories: List["ProcessingHistory"] = []


class FlightBase(BaseModel):
    flight_no: Optional[str] = None
    flight_date: Optional[datetime] = None
    departure: Optional[str] = None
    arrival: Optional[str] = None
    scheduled_departure: Optional[datetime] = None
    actual_departure: Optional[datetime] = None
    scheduled_arrival: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    airline: Optional[str] = None
    is_responsible: bool = False
    delay_minutes: int = 0
    cancel_reason: Optional[str] = None


class FlightCreate(FlightBase):
    grievance_id: int


class Flight(FlightBase):
    id: int
    grievance_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PhotoIndexBase(BaseModel):
    photo_path: Optional[str] = None
    photo_hash: Optional[str] = None
    photo_type: Optional[str] = None
    is_valid: bool = True
    ocr_text: Optional[str] = None


class PhotoIndexCreate(PhotoIndexBase):
    grievance_id: int


class PhotoIndex(PhotoIndexBase):
    id: int
    grievance_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProcessingHistoryBase(BaseModel):
    action: Optional[str] = None
    rule_name: Optional[str] = None
    rule_result: Optional[bool] = None
    detail: Optional[str] = None
    operator: Optional[str] = None


class ProcessingHistoryCreate(ProcessingHistoryBase):
    batch_id: Optional[int] = None
    grievance_id: Optional[int] = None


class ProcessingHistory(ProcessingHistoryBase):
    id: int
    batch_id: Optional[int] = None
    grievance_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CompensationRuleBase(BaseModel):
    rule_code: str
    rule_name: str
    rule_level: RuleLevel
    max_amount: float = 0.0
    min_amount: float = 0.0
    incident_type: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class CompensationRuleCreate(CompensationRuleBase):
    pass


class CompensationRule(CompensationRuleBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    success: bool
    batch_no: str
    message: str
    total_count: int = 0
    file_hash: Optional[str] = None


class BatchResultResponse(BaseModel):
    batch: Batch
    grievances: List[Grievance]
    approved_count: int = 0
    rejected_count: int = 0
    pending_count: int = 0
    total_amount: float = 0.0


class RuleResult(BaseModel):
    rule_name: str
    passed: bool
    message: str
    detail: Optional[Dict[str, Any]] = None


class RulesEngineResult(BaseModel):
    grievance_no: str
    overall_passed: bool
    rule_results: List[RuleResult]
    suggested_amount: float = 0.0
    rule_level: Optional[RuleLevel] = None


BatchDetail.model_rebuild()
GrievanceDetail.model_rebuild()
