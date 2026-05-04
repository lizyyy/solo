from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import RiskType, RiskSeverity, RiskStatus


class StallBase(BaseModel):
    name: str
    location: Optional[str] = None
    power_required_kw: float
    circuit_id: Optional[int] = None
    is_rain_protected: bool = False
    has_rcd_protection: bool = True
    is_critical: bool = False


class StallCreate(StallBase):
    pass


class StallUpdate(StallBase):
    name: Optional[str] = None
    power_required_kw: Optional[float] = None


class StallResponse(StallBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CircuitBase(BaseModel):
    name: str
    panel_name: Optional[str] = None
    phase: Optional[str] = None
    max_capacity_kw: float
    generator_id: Optional[int] = None


class CircuitCreate(CircuitBase):
    pass


class CircuitUpdate(CircuitBase):
    name: Optional[str] = None
    max_capacity_kw: Optional[float] = None


class CircuitResponse(CircuitBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GeneratorBase(BaseModel):
    name: str
    capacity_kw: float
    redundancy_threshold: float = 0.3


class GeneratorCreate(GeneratorBase):
    pass


class GeneratorUpdate(GeneratorBase):
    name: Optional[str] = None
    capacity_kw: Optional[float] = None


class GeneratorResponse(GeneratorBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DrillRecordBase(BaseModel):
    drill_date: datetime
    circuits_tested: Optional[str] = None
    stages_tested: Optional[str] = None
    critical_stages: Optional[str] = None
    notes: Optional[str] = None


class DrillRecordCreate(DrillRecordBase):
    pass


class DrillRecordResponse(DrillRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewCommentBase(BaseModel):
    risk_id: int
    reviewer: str
    comment: str


class ReviewCommentCreate(ReviewCommentBase):
    pass


class ReviewCommentResponse(ReviewCommentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RiskResultResponse(BaseModel):
    id: int
    risk_type: RiskType
    description: str
    severity: RiskSeverity
    status: RiskStatus
    circuit_id: Optional[int] = None
    stall_id: Optional[int] = None
    generator_id: Optional[int] = None
    calculated_value: Optional[float] = None
    threshold_value: Optional[float] = None
    manual_override: bool
    override_reason: Optional[str] = None
    overridden_by: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ManualOverrideRequest(BaseModel):
    risk_id: int
    overridden_by: str
    override_reason: str
    new_status: RiskStatus = RiskStatus.MANUAL_OVERRIDE


class ImportResult(BaseModel):
    message: str
    imported_count: int
    failed_count: int
    errors: List[str] = []


class RiskSummary(BaseModel):
    total_risks: int
    by_severity: dict
    by_type: dict
    open_risks: int
    resolved_risks: int
