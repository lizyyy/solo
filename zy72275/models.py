from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class CoordinateType(str, Enum):
    LAT_LNG = "lat_lng"
    METRIC = "metric"
    MIXED = "mixed"
    UNKNOWN = "unknown"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    NEEDS_REVIEW = "needs_review"
    ROLLBACKED = "rollbacked"


class ChangeRecord(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    operator: str
    field_name: str
    old_value: Any
    new_value: Any
    reason: Optional[str] = None


class OriginPoint(BaseModel):
    id: str
    source_file: str
    original_line_number: int
    raw_content: str
    coordinate_type: CoordinateType = CoordinateType.UNKNOWN
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    manual_modified: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    metric_x: Optional[float] = None
    metric_y: Optional[float] = None
    remark: Optional[str] = None
    inspection_photo_id: Optional[str] = None
    site_instruction: Optional[str] = None
    import_batch: str
    version: int = 1
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    change_history: List[ChangeRecord] = Field(default_factory=list)


class ImportBatch(BaseModel):
    batch_id: str
    source_file: str
    imported_at: datetime = Field(default_factory=datetime.now)
    operator: str
    total_records: int
    new_records: int
    updated_records: int
    skipped_records: int
    status: str = "completed"


class ArchiveSummary(BaseModel):
    total_records: int
    by_coordinate_type: Dict[CoordinateType, int]
    by_status: Dict[ProcessingStatus, int]
    last_updated: datetime
