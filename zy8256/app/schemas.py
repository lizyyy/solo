from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class AnomalyType(str, Enum):
    VOC_EXCEED = "voc_exceed"
    VENTILATION_INSUFFICIENT = "ventilation_insufficient"
    WORK_TICKET_OVERLAP = "work_ticket_overlap"
    SENSOR_MISSING = "sensor_missing"


class Severity(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ImportResponse(BaseModel):
    success: bool
    success_count: int
    error_count: int
    errors: Optional[List[Dict[str, Any]]] = None
    warnings: Optional[List[Dict[str, Any]]] = None


class CabinResponse(BaseModel):
    id: int
    cabin_code: str
    cabin_name: str
    area: Optional[float] = None
    volume: Optional[float] = None
    location: Optional[str] = None
    vessel_name: Optional[str] = None
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class WorkTicketResponse(BaseModel):
    id: int
    ticket_no: str
    cabin_code: str
    operation_type: Optional[str] = None
    paint_type: Optional[str] = None
    start_time: datetime
    end_time: datetime
    workers_count: Optional[int] = None
    supervisor: Optional[str] = None
    status: str
    
    class Config:
        from_attributes = True


class SensorLogResponse(BaseModel):
    id: int
    sensor_id: str
    cabin_code: str
    timestamp: datetime
    voc_value: float
    voc_unit: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    ventilation_rate: Optional[float] = None
    air_changes_per_hour: Optional[float] = None
    
    class Config:
        from_attributes = True


class VentilationRuleResponse(BaseModel):
    id: int
    rule_code: str
    rule_name: str
    cabin_code: Optional[str] = None
    operation_type: Optional[str] = None
    paint_type: Optional[str] = None
    min_air_changes_per_hour: float
    voc_threshold_ppm: Optional[float] = None
    voc_threshold_mg_m3: Optional[float] = None
    is_active: bool
    priority: int
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class RiskAnomalyResponse(BaseModel):
    id: int
    anomaly_type: str
    severity: str
    cabin_code: Optional[str] = None
    work_ticket_id: Optional[int] = None
    sensor_log_id: Optional[int] = None
    sensor_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    description: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    is_confirmed: bool
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class RiskCheckResponse(BaseModel):
    summary: Dict[str, Any]
    details: Dict[str, Any]


class AnomalyConfirmRequest(BaseModel):
    confirmed: bool
    confirmed_by: Optional[str] = None
    notes: Optional[str] = None


class ReportFormat(str, Enum):
    MARKDOWN = "markdown"
    CSV = "csv"
    JSON = "json"


class ReportResponse(BaseModel):
    success: bool
    format: str
    content: Optional[str] = None
    file_path: Optional[str] = None
    message: str


class AuditLogResponse(BaseModel):
    id: int
    operation: str
    resource_type: str
    resource_id: Optional[int] = None
    details: Optional[Dict[str, Any]] = None
    performed_at: datetime
    performed_by: str
    
    class Config:
        from_attributes = True


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
