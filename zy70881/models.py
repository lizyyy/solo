from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Any, Optional
from enum import Enum


class RecordStatus(str, Enum):
    SUCCESS = "success"
    PENDING = "pending"
    FAILED = "failed"


class MeterData(BaseModel):
    meter_id: str
    tenant_id: Optional[str] = None
    zone_id: Optional[str] = None
    reading_date: datetime
    peak_kwh: float = 0.0
    valley_kwh: float = 0.0
    normal_kwh: float = 0.0
    total_kwh: float = 0.0
    power_factor: Optional[float] = None
    raw_data: Dict[str, Any]


class TenantContract(BaseModel):
    contract_id: str
    tenant_id: str
    tenant_name: str
    zone_id: str
    start_date: datetime
    end_date: Optional[datetime] = None
    power_multiplier: float = 1.0
    multiplier_effective_date: Optional[datetime] = None
    overtime_rates: Dict[str, float] = Field(default_factory=dict)
    is_active: bool = True


class TemperatureZone(BaseModel):
    zone_id: str
    zone_name: str
    base_temperature: float
    power_multiplier: float = 1.0
    area_sqm: float


class AllocationRecord(BaseModel):
    record_id: str
    status: RecordStatus
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None
    meter_id: str
    zone_id: Optional[str] = None
    reading_date: datetime
    original_kwh: float
    allocated_kwh: float = 0.0
    power_multiplier: float = 1.0
    amount: float = 0.0
    error_message: Optional[str] = None
    suggestions: Optional[List[str]] = None
    source_trace: Dict[str, Any] = Field(default_factory=dict)
    raw_data: Dict[str, Any]


class ProcessedResult(BaseModel):
    batch_id: str
    processed_at: datetime
    total_records: int = 0
    success_count: int = 0
    pending_count: int = 0
    failed_count: int = 0
    success_items: List[AllocationRecord] = Field(default_factory=list)
    pending_items: List[AllocationRecord] = Field(default_factory=list)
    failed_items: List[AllocationRecord] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)


class BatchSummary(BaseModel):
    batch_id: str
    processed_at: datetime
    total_records: int
    success_count: int
    pending_count: int
    failed_count: int
    total_amount: float = 0.0
