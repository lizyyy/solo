from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_MORE_INFO = "needs_more_info"


class ViolationType(str, Enum):
    WIND_SPEED_EXCEEDED = "wind_speed_exceeded"
    DOSAGE_EXCEEDED = "dosage_exceeded"
    SAFETY_INTERVAL_VIOLATED = "safety_interval_violated"
    INSUFFICIENT_STOCK = "insufficient_stock"
    AREA_MISMATCH = "area_mismatch"


class Pesticide(BaseModel):
    id: str
    name: str
    stock_quantity: float = Field(description="库存数量(升/公斤)")
    max_dosage_per_hectare: float = Field(description="每公顷最大用量")
    safety_interval_days: int = Field(description="安全间隔期(天)")
    max_wind_speed: float = Field(description="最大允许风速(m/s)")
    unit: str = "L"


class WeatherRecord(BaseModel):
    id: str
    date: date
    area: str
    wind_speed: float = Field(description="风速(m/s)")
    temperature: float
    humidity: float
    rainfall: float = Field(description="降雨量(mm)")


class SprayJob(BaseModel):
    id: str
    job_date: date
    area: str
    area_size_hectares: float = Field(description="喷洒面积(公顷)")
    pesticide_id: str
    pesticide_name: str
    dosage_used: float = Field(description="实际使用量")
    operator: str
    notes: Optional[str] = None
    last_spray_date: Optional[date] = Field(None, description="上次喷洒日期")


class Violation(BaseModel):
    type: ViolationType
    severity: str = "warning"
    message: str
    expected_value: Optional[float] = None
    actual_value: Optional[float] = None
    details: Optional[Dict[str, Any]] = None


class ValidationResult(BaseModel):
    job_id: str
    is_valid: bool
    violations: List[Violation] = Field(default_factory=list)
    stock_sufficient: Optional[bool] = None
    stock_available: Optional[float] = None
    stock_needed: Optional[float] = None


class ReviewRecord(BaseModel):
    id: str
    job_id: str
    reviewer: str
    status: ReviewStatus
    review_notes: str
    reviewed_at: datetime = Field(default_factory=datetime.now)
    adjusted_dosage: Optional[float] = None
    adjusted_area: Optional[float] = None
    override_violations: List[ViolationType] = Field(default_factory=list)


class ReconciliationSummary(BaseModel):
    total_jobs: int
    valid_jobs: int
    invalid_jobs: int
    pending_review: int
    approved: int
    rejected: int
    needs_more_info: int
    total_dosage_used: float
    total_stock_used: float
    total_stock_remaining: float
    violation_counts: Dict[str, int] = Field(default_factory=dict)


class ReconciliationSession(BaseModel):
    id: str
    name: str
    created_at: datetime
    status: str = "active"


class ReconciliationReport(BaseModel):
    session_id: str
    generated_at: datetime
    summary: ReconciliationSummary
    job_details: List[Dict[str, Any]]
    review_records: List[Dict[str, Any]]
