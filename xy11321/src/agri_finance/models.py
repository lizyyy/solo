from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class BillingType(str, Enum):
    PER_HOUR = "per_hour"
    PER_MU = "per_mu"
    FUEL = "fuel"
    MIXED = "mixed"


class RecordStatus(str, Enum):
    PENDING = "pending"
    VALID = "valid"
    INVALID = "invalid"
    BILLED = "billed"
    REVIEWED = "reviewed"


class ImportSource(str, Enum):
    JOB_SHEET = "job_sheet"
    FUEL_LOG = "fuel_log"
    RATE_TABLE = "rate_table"


class JobRecord(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    
    id: Optional[int] = None
    batch_id: str
    row_number: int
    tractor_id: str
    operator_id: str
    operator_name: Optional[str] = None
    job_date: datetime
    work_hours: Optional[float] = None
    work_mu: Optional[float] = None
    fuel_used: Optional[float] = None
    billing_type: BillingType = BillingType.MIXED
    status: RecordStatus = RecordStatus.PENDING
    raw_data: dict
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class FuelRecord(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    
    id: Optional[int] = None
    batch_id: str
    row_number: int
    tractor_id: str
    fuel_date: datetime
    fuel_amount: float
    fuel_unit: str = "L"
    status: RecordStatus = RecordStatus.PENDING
    raw_data: dict
    created_at: datetime = Field(default_factory=datetime.now)


class RateTable(BaseModel):
    id: Optional[int] = None
    tractor_id: str
    effective_date: datetime
    hourly_rate: float = 0.0
    mu_rate: float = 0.0
    fuel_rate: float = 0.0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)


class BadRecord(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    
    id: Optional[int] = None
    batch_id: str
    source_type: ImportSource
    row_number: int
    raw_data: dict
    error_message: str
    suggestion: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class BillingRecord(BaseModel):
    id: Optional[int] = None
    job_record_id: int
    batch_id: str
    tractor_id: str
    operator_id: str
    operator_name: Optional[str] = None
    job_date: datetime
    hourly_charge: float = 0.0
    mu_charge: float = 0.0
    fuel_charge: float = 0.0
    total_charge: float = 0.0
    status: RecordStatus = RecordStatus.PENDING
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)


class ImportBatch(BaseModel):
    id: Optional[int] = None
    batch_id: str
    source_type: ImportSource
    file_name: str
    file_hash: str
    total_records: int = 0
    valid_records: int = 0
    invalid_records: int = 0
    imported_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class SensitiveField(BaseModel):
    field_name: str
    display_mask: str = "***"
    export_mask: str = "***"
    log_mask: str = "***"
