from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    SAFE = "safe"


class RuleVersion(BaseModel):
    version: str
    effective_date: datetime
    description: str
    is_active: bool = True


class PortInspectionRule(BaseModel):
    version: str
    port_ranges: Dict[str, RiskLevel]
    reserved_ports: List[int]
    threshold_connections: int
    description: str


class InspectionSample(BaseModel):
    sample_id: str
    batch_id: str
    source_file: str
    row_number: int
    ip_address: str
    port: int
    protocol: str
    process_name: str
    connection_count: int
    supplier: str
    supplier_original: str
    supplier_corrected: Optional[str] = None
    department: str
    business_line: str
    inspection_time: datetime
    raw_data: Dict[str, Any]


class InspectionResult(BaseModel):
    sample_id: str
    batch_id: str
    rule_version: str
    risk_level: RiskLevel
    is_anomaly: bool
    conclusion: str
    port_status: str
    details: Dict[str, Any]
    reviewed: bool = False
    reviewer: Optional[str] = None
    review_time: Optional[datetime] = None
    review_notes: Optional[str] = None
    is_reused: bool = False
    original_sample_id: Optional[str] = None
    original_batch_id: Optional[str] = None
    conflict_info: Optional[Dict[str, Any]] = None


class BatchInfo(BaseModel):
    batch_id: str
    submit_time: datetime
    rule_version_at_submit: str
    total_samples: int
    anomaly_count: int
    status: str
    source_files: List[str]
    notes: Optional[str] = None


class ExportRecord(BaseModel):
    export_id: str
    batch_id: str
    export_time: datetime
    exported_by: str
    filter_criteria: Dict[str, Any]
    file_path: str
