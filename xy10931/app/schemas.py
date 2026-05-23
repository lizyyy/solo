from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ResearchGroupBase(BaseModel):
    name: str
    leader: str
    contact: Optional[str] = None


class ResearchGroupCreate(ResearchGroupBase):
    pass


class ResearchGroup(ResearchGroupBase):
    id: int
    credit_score: float
    created_at: datetime

    class Config:
        from_attributes = True


class InstrumentBase(BaseModel):
    name: str
    model: Optional[str] = None
    location: Optional[str] = None
    hourly_rate: float
    max_reservation_hours: int = 8
    requires_risk_assessment: bool = False


class InstrumentCreate(InstrumentBase):
    pass


class Instrument(InstrumentBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReservationBase(BaseModel):
    instrument_id: int
    group_id: int
    user_name: str
    start_time: datetime
    end_time: datetime
    sample_type: Optional[str] = None
    purpose: Optional[str] = None


class ReservationCreate(ReservationBase):
    pass


class ReservationUpdate(BaseModel):
    status: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    user_name: Optional[str] = None


class Reservation(ReservationBase):
    id: int
    status: str
    created_at: datetime
    instrument: Instrument
    group: ResearchGroup

    class Config:
        from_attributes = True


class SampleRiskBase(BaseModel):
    reservation_id: int
    risk_level: str
    contamination_risk: bool = False
    biohazard_level: int = 0
    special_requirements: Optional[str] = None


class SampleRiskCreate(SampleRiskBase):
    pass


class SampleRiskApprove(BaseModel):
    approved: bool
    approved_by: str


class SampleRisk(SampleRiskBase):
    id: int
    approved: bool
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CancellationRecordBase(BaseModel):
    reservation_id: int
    cancelled_by: str
    reason: Optional[str] = None


class CancellationRecordCreate(CancellationRecordBase):
    pass


class CancellationRecord(CancellationRecordBase):
    id: int
    penalty_amount: float
    penalty_applied: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UsageReportBase(BaseModel):
    reservation_id: int
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    issues_found: Optional[str] = None
    sample_contamination: bool = False
    submitted_by: str


class UsageReportCreate(UsageReportBase):
    pass


class UsageReport(UsageReportBase):
    id: int
    instrument_id: int
    group_id: int
    actual_duration_hours: Optional[float] = None
    exceeded_hours: float
    overtime_penalty: float
    total_cost: Optional[float] = None
    submitted_at: datetime

    class Config:
        from_attributes = True


class ExceptionLogBase(BaseModel):
    endpoint: str
    raw_input: str
    error_type: str
    error_message: str


class ExceptionLogCreate(ExceptionLogBase):
    pass


class ExceptionLogHandle(BaseModel):
    handling_conclusion: str
    handled_by: str


class ExceptionLog(ExceptionLogBase):
    id: int
    handling_conclusion: Optional[str] = None
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None
    created_at: datetime
    resolved: bool

    class Config:
        from_attributes = True


class ManualCorrection(BaseModel):
    reservation_id: int
    corrected_by: str
    reason: str
    new_status: Optional[str] = None
    new_start_time: Optional[datetime] = None
    new_end_time: Optional[datetime] = None
    waive_penalty: bool = False


class ExportParams(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    instrument_id: Optional[int] = None
    group_id: Optional[int] = None
    export_format: str = "excel"
