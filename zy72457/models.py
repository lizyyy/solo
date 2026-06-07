from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class PointStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    CONSTRUCTION_DETOUR = "construction_detour"
    RESIDENT_REVIEW = "resident_review"
    UPDATED = "updated"


class AbnormalType(str, Enum):
    DUPLICATE_IMPORT = "duplicate_import"
    CONSTRUCTION_NOT_SYNCED = "construction_not_synced"
    RADIUS_MISMATCH = "radius_mismatch"
    EXPORT_INCONSISTENT = "export_inconsistent"


class AuditLog(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    operator: str
    action: str
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    remark: Optional[str] = None


class NightSamplingPoint(BaseModel):
    id: str
    original_row_number: int
    name: str
    address: str
    longitude: float
    latitude: float
    service_radius: float
    complaint_id: Optional[str] = None
    status: PointStatus = PointStatus.PENDING_REVIEW
    abnormal_types: List[AbnormalType] = Field(default_factory=list)
    audit_logs: List[AuditLog] = Field(default_factory=list)
    import_batch_id: str
    is_manual_modified: bool = False
    construction_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ServiceRadiusResult(BaseModel):
    point_id: str
    point_name: str
    original_radius: float
    calculated_radius: float
    final_radius: float
    coverage_area: Optional[float] = None
    resident_count: Optional[int] = None
    is_abnormal: bool = False
    abnormal_reason: Optional[str] = None
    calculation_time: datetime = Field(default_factory=datetime.now)


class ImportBatch(BaseModel):
    batch_id: str
    file_name: str
    import_time: datetime = Field(default_factory=datetime.now)
    operator: str
    total_count: int
    point_ids: List[str] = Field(default_factory=list)
    status: str = "imported"
