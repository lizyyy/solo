from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum


class BillingType(str, Enum):
    HOUR = "hour"
    AREA = "area"
    FUEL = "fuel"
    MIXED = "mixed"


class RecordStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SETTLED = "settled"


class ExceptionType(str, Enum):
    MISSING_FIELD = "missing_field"
    CROSS_DAY = "cross_day"
    BELOW_MINIMUM = "below_minimum"
    BAD_ROW = "bad_row"
    DUPLICATE = "duplicate"
    INVALID_DATA = "invalid_data"


class WorkRecord(BaseModel):
    id: Optional[str] = None
    record_no: str
    tractor_no: str
    operator: str
    work_date: date
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    work_hours: Optional[float] = None
    work_area: Optional[float] = None
    fuel_consumption: Optional[float] = None
    billing_type: BillingType
    hourly_rate: Optional[float] = None
    area_rate: Optional[float] = None
    fuel_rate: Optional[float] = None
    remarks: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class ProcessedRecord(WorkRecord):
    status: RecordStatus
    amount: float = 0.0
    exception_type: Optional[ExceptionType] = None
    exception_reason: Optional[str] = None
    is_cross_day: bool = False
    processed_at: datetime = Field(default_factory=datetime.now)


class SettlementRecord(BaseModel):
    id: str
    record_ids: List[str]
    operator: str
    total_amount: float
    settlement_date: date
    created_at: datetime = Field(default_factory=datetime.now)


class BillingRules(BaseModel):
    minimum_charge: float = 50.0
    cross_day_enabled: bool = True
    duplicate_check_enabled: bool = True
    bad_row_isolation_enabled: bool = True


class BatchResult(BaseModel):
    total: int
    success_count: int
    failed_count: int
    success_ids: List[str]
    failed_details: List[Dict[str, Any]]


class QueryFilter(BaseModel):
    operator: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[RecordStatus] = None
    exception_type: Optional[ExceptionType] = None
