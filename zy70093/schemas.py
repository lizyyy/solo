from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ChargingPileBase(BaseModel):
    pile_code: str
    station_name: str
    location: Optional[str] = None
    power: int = 60


class ChargingPileCreate(ChargingPileBase):
    pass


class ChargingPileResponse(ChargingPileBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class FaultEventBase(BaseModel):
    pile_code: str
    fault_type: str
    fault_level: str = "MEDIUM"
    description: Optional[str] = None
    source: str = "AUTOMATIC"


class FaultEventCreate(FaultEventBase):
    pass


class FaultEventResponse(BaseModel):
    id: int
    fault_code: str
    pile_code: str
    station_name: str
    fault_type: str
    fault_level: str
    description: Optional[str] = None
    source: str
    status: str
    reported_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    sla_expires_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ReservationBase(BaseModel):
    pile_code: str
    user_id: str
    user_name: Optional[str] = None
    phone: Optional[str] = None
    reserved_start: datetime
    reserved_end: datetime


class ReservationCreate(ReservationBase):
    pass


class ReservationResponse(BaseModel):
    id: int
    reservation_code: str
    pile_code: str
    user_id: str
    user_name: Optional[str] = None
    phone: Optional[str] = None
    reserved_start: datetime
    reserved_end: datetime
    status: str
    is_frozen: bool
    frozen_reason: Optional[str] = None
    frozen_at: Optional[datetime] = None
    unfrozen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ChargingSessionBase(BaseModel):
    pile_code: str
    user_id: str
    start_kwh: float = 0


class ChargingSessionCreate(ChargingSessionBase):
    pass


class ChargingSessionResponse(BaseModel):
    id: int
    session_code: str
    pile_code: str
    user_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    start_kwh: float
    end_kwh: Optional[float] = None
    charged_kwh: Optional[float] = None
    status: str
    is_truncated: bool
    truncation_reason: Optional[str] = None
    truncated_at: Optional[datetime] = None
    total_amount: Optional[float] = None
    settlement_status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DispatchOrderBase(BaseModel):
    fault_code: str
    engineer_id: str
    engineer_name: str
    engineer_phone: Optional[str] = None
    priority: str = "NORMAL"


class DispatchOrderCreate(DispatchOrderBase):
    pass


class DispatchOrderResponse(BaseModel):
    id: int
    order_code: str
    fault_code: str
    engineer_id: str
    engineer_name: str
    engineer_phone: Optional[str] = None
    priority: str
    status: str
    dispatched_at: datetime
    accepted_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    timeout_count: int
    reassigned_from: Optional[int] = None
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SLARecordResponse(BaseModel):
    id: int
    fault_code: str
    sla_type: str
    target_minutes: int
    actual_minutes: Optional[float] = None
    is_met: Optional[bool] = None
    warning_sent: bool
    expired_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class RecoveryReportBase(BaseModel):
    fault_code: str
    root_cause: str
    solution: str
    preventive_measures: Optional[str] = None
    recovery_time_minutes: Optional[float] = None
    parts_replaced: Optional[str] = None
    verified_by: Optional[str] = None


class RecoveryReportCreate(RecoveryReportBase):
    pass


class RecoveryReportResponse(BaseModel):
    id: int
    report_code: str
    fault_code: str
    root_cause: str
    solution: str
    preventive_measures: Optional[str] = None
    recovery_time_minutes: Optional[float] = None
    parts_replaced: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class BusinessResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    error_code: Optional[str] = None


class FaultEventDetailResponse(FaultEventResponse):
    dispatches: List[DispatchOrderResponse] = []
    reservations: List[ReservationResponse] = []
    charging_sessions: List[ChargingSessionResponse] = []
    sla_records: List[SLARecordResponse] = []
    recovery_report: Optional[RecoveryReportResponse] = None
