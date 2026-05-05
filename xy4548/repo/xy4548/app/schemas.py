from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class InspectionStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"

class RiskLevel(str, Enum):
    UNKNOWN = "unknown"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ReservationStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class RiskAssessment(str, Enum):
    NORMAL = "normal"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class FlyAshBatchBase(BaseModel):
    batch_number: str = Field(..., min_length=1, max_length=50)
    batch_date: datetime
    ash_source: Optional[str] = None
    total_weight: Optional[float] = 0.0
    bag_count: Optional[int] = 0
    chelating_agent_type: Optional[str] = None
    chelating_agent_dosage: Optional[float] = 0.0
    mixing_duration: Optional[float] = 0.0
    operator: Optional[str] = None

class FlyAshBatchCreate(FlyAshBatchBase):
    pass

class FlyAshBatchUpdate(BaseModel):
    ash_source: Optional[str] = None
    total_weight: Optional[float] = None
    bag_count: Optional[int] = None
    chelating_agent_type: Optional[str] = None
    chelating_agent_dosage: Optional[float] = None
    mixing_duration: Optional[float] = None
    operator: Optional[str] = None

class FlyAshBatchResponse(FlyAshBatchBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class TonBagBase(BaseModel):
    bag_number: str = Field(..., min_length=1, max_length=50)
    batch_id: int
    weight: float = Field(..., gt=0)
    rfid_tag: Optional[str] = None
    storage_location: Optional[str] = None
    production_time: Optional[datetime] = None

class TonBagCreate(TonBagBase):
    pass

class TonBagUpdate(BaseModel):
    weight: Optional[float] = None
    rfid_tag: Optional[str] = None
    storage_location: Optional[str] = None
    production_time: Optional[datetime] = None
    inspection_status: Optional[str] = None
    risk_level: Optional[str] = None
    is_qualified: Optional[bool] = None
    is_outbound: Optional[bool] = None
    outbound_time: Optional[datetime] = None
    reservation_id: Optional[int] = None

class TonBagResponse(TonBagBase):
    id: int
    inspection_status: str
    risk_level: str
    is_qualified: bool
    is_outbound: bool
    outbound_time: Optional[datetime] = None
    reservation_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class InspectionRecordBase(BaseModel):
    inspection_number: str = Field(..., min_length=1, max_length=50)
    batch_id: Optional[int] = None
    bag_id: Optional[int] = None
    inspection_type: Optional[str] = None
    inspection_date: datetime
    inspector: Optional[str] = None
    leaching_pb: Optional[float] = None
    leaching_cd: Optional[float] = None
    leaching_cr: Optional[float] = None
    leaching_hg: Optional[float] = None
    leaching_as: Optional[float] = None
    leaching_zn: Optional[float] = None
    leaching_cu: Optional[float] = None
    leaching_ni: Optional[float] = None
    inspection_report: Optional[str] = None

class InspectionRecordCreate(InspectionRecordBase):
    pass

class InspectionRecordUpdate(BaseModel):
    inspection_type: Optional[str] = None
    inspection_date: Optional[datetime] = None
    inspector: Optional[str] = None
    leaching_pb: Optional[float] = None
    leaching_cd: Optional[float] = None
    leaching_cr: Optional[float] = None
    leaching_hg: Optional[float] = None
    leaching_as: Optional[float] = None
    leaching_zn: Optional[float] = None
    leaching_cu: Optional[float] = None
    leaching_ni: Optional[float] = None
    is_qualified: Optional[bool] = None
    inspection_report: Optional[str] = None

class InspectionRecordResponse(InspectionRecordBase):
    id: int
    is_qualified: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class LandfillReservationBase(BaseModel):
    reservation_number: str = Field(..., min_length=1, max_length=50)
    batch_id: Optional[int] = None
    reservation_date: datetime
    planned_outbound_date: Optional[datetime] = None
    landfill_site: Optional[str] = None
    transport_company: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    reserved_weight: float = Field(..., gt=0)
    actual_weight: Optional[float] = None

class LandfillReservationCreate(LandfillReservationBase):
    pass

class LandfillReservationUpdate(BaseModel):
    planned_outbound_date: Optional[datetime] = None
    landfill_site: Optional[str] = None
    transport_company: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    reserved_weight: Optional[float] = None
    actual_weight: Optional[float] = None
    status: Optional[str] = None
    is_completed: Optional[bool] = None
    completion_time: Optional[datetime] = None

class LandfillReservationResponse(LandfillReservationBase):
    id: int
    status: str
    is_completed: bool
    completion_time: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ReviewNoteBase(BaseModel):
    batch_id: Optional[int] = None
    reservation_id: Optional[int] = None
    reviewer: str = Field(..., min_length=1, max_length=100)
    review_time: Optional[datetime] = None
    risk_assessment: Optional[str] = "normal"
    note_content: str = Field(..., min_length=1)
    is_exception: Optional[bool] = False
    exception_reason: Optional[str] = None
    approved_by: Optional[str] = None
    approval_time: Optional[datetime] = None

class ReviewNoteCreate(ReviewNoteBase):
    pass

class ReviewNoteUpdate(BaseModel):
    risk_assessment: Optional[str] = None
    note_content: Optional[str] = None
    is_exception: Optional[bool] = None
    exception_reason: Optional[str] = None
    approved_by: Optional[str] = None
    approval_time: Optional[datetime] = None

class ReviewNoteResponse(ReviewNoteBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class AuditLogBase(BaseModel):
    operation_type: str = Field(..., min_length=1, max_length=50)
    module: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    operator: Optional[str] = None
    ip_address: Optional[str] = None
    operation_detail: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    is_successful: Optional[bool] = True
    failure_reason: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    id: int
    log_time: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

class OutboundValidationResult(BaseModel):
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    unqualified_bags: List[str] = []
    duplicate_bags: List[str] = []
    weight_mismatch: bool = False
    weight_difference: Optional[float] = None

class RiskRecalculationRequest(BaseModel):
    bag_ids: List[int]
    operator: str

class RiskRecalculationResult(BaseModel):
    bag_id: int
    bag_number: str
    old_risk_level: str
    new_risk_level: str
    risk_factors: List[str]

class ManualOverrideRequest(BaseModel):
    bag_id: int
    new_is_qualified: bool
    override_reason: str
    operator: str
    approval_required: bool = False

class ManualOverrideResult(BaseModel):
    is_successful: bool
    message: str
    bag_number: str
    old_is_qualified: bool
    new_is_qualified: bool

class ImportResult(BaseModel):
    total_count: int
    success_count: int
    failed_count: int
    failed_items: List[dict] = []
    warnings: List[str] = []
