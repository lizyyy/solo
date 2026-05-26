from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class BatchStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    RETURNED = "returned"
    SUPPLEMENT_NEEDED = "supplement_needed"


class AuditAction(str, Enum):
    CREATE = "create"
    SUBMIT = "submit"
    PROCESS = "process"
    APPROVE = "approve"
    RETURN = "return"
    SUPPLEMENT = "supplement"
    UPDATE = "update"


class ChemicalBase(BaseModel):
    name: str
    batch_no: str
    manufacturer: Optional[str] = None
    active_ingredient: Optional[str] = None
    concentration: Optional[float] = None
    max_dosage_per_ha: float
    safety_interval_hours: int
    min_wind_speed: float = 0.0
    max_wind_speed: float = 10.0


class ChemicalCreate(ChemicalBase):
    pass


class Chemical(ChemicalBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class JobBase(BaseModel):
    job_no: str
    site_name: Optional[str] = None
    area_ha: Optional[float] = None
    target_pest: Optional[str] = None
    description: Optional[str] = None


class JobCreate(JobBase):
    csv_data: Optional[str] = None


class Job(JobBase):
    id: int
    csv_data: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WeatherRecordBase(BaseModel):
    record_time: datetime
    location: str
    wind_speed: Optional[float] = None
    wind_direction: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rainfall: float = 0.0
    weather_window_start: Optional[datetime] = None
    weather_window_end: Optional[datetime] = None


class WeatherRecordCreate(WeatherRecordBase):
    pass


class WeatherRecord(WeatherRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    batch_no: str
    spray_area: str
    chemical_id: int
    job_id: int
    weather_id: int
    dosage: float
    planned_date: datetime
    operator: Optional[str] = None


class BatchCreate(BatchBase):
    pass


class BatchUpdate(BaseModel):
    operator: Optional[str] = None
    dosage: Optional[float] = None
    planned_date: Optional[datetime] = None


class Batch(BatchBase):
    id: int
    status: BatchStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BatchDetail(Batch):
    chemical: Optional[Chemical] = None
    job: Optional[Job] = None
    weather: Optional[WeatherRecord] = None


class AuditLogBase(BaseModel):
    action: str
    reason: Optional[str] = None
    handler: Optional[str] = None
    details: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    batch_id: int
    old_status: Optional[str] = None
    new_status: Optional[str] = None


class AuditLog(AuditLogBase):
    id: int
    batch_id: int
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class BatchWithAudit(BatchDetail):
    audit_logs: List["AuditLogDisplay"] = []


class AuditLogDisplay(BaseModel):
    time: str
    action: str
    handler: str
    reason: Optional[str] = None
    transition: Optional[str] = None
    details: Optional[str] = None

    class Config:
        from_attributes = True


class ValidationResult(BaseModel):
    passed: bool
    violations: List[str] = []
    warnings: List[str] = []


class BatchQueryParams(BaseModel):
    spray_area: Optional[str] = None
    chemical_batch_no: Optional[str] = None
    weather_window_start: Optional[datetime] = None
    weather_window_end: Optional[datetime] = None
    status: Optional[BatchStatus] = None
    batch_no: Optional[str] = None


class ExportRecord(BaseModel):
    batch_no: str
    spray_area: str
    chemical_name: str
    chemical_batch_no: str
    dosage: float
    planned_date: datetime
    status: str
    operator: Optional[str] = None
    wind_speed: Optional[float] = None
    temperature: Optional[float] = None
    validation_notes: List[str] = []
    audit_summary: List[str] = []
