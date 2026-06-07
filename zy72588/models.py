from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class MaterialType(str, Enum):
    NORMAL = "正常材料"
    WRONG_CALIBER = "错口径材料"
    SUPPLEMENTARY = "补录材料"


class ConflictStatus(str, Enum):
    PENDING = "待确认"
    CONFIRMED = "已确认"
    REJECTED = "已驳回"


class ThresholdNote(BaseModel):
    note_id: str
    version: int
    thresholds: Dict[str, float]
    reporter: str
    report_time: datetime
    import_time: Optional[datetime] = None
    is_supplementary: bool = False
    original_note_id: Optional[str] = None
    comment: Optional[str] = None


class ExperimentBucket(BaseModel):
    bucket_id: str
    bucket_name: str
    thresholds: Dict[str, float]
    update_time: datetime
    reviewer: Optional[str] = None
    review_time: Optional[datetime] = None


class StratificationMetric(BaseModel):
    layer_name: str
    auc: float
    sample_count: int
    is_anomaly: bool = False
    anomaly_reason: Optional[str] = None


class StratificationMetricsRecord(BaseModel):
    record_id: str
    note_id: str
    bucket_id: Optional[str] = None
    metrics: List[StratificationMetric]
    calc_time: datetime
    material_type: MaterialType
    is_recalculated: bool = False
    original_record_id: Optional[str] = None


class SelfCheckResult(BaseModel):
    check_name: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None


class ConflictEvidence(BaseModel):
    field_name: str
    note_value: Any
    bucket_value: Any
    description: str


class ConflictRecord(BaseModel):
    conflict_id: str
    note_id: str
    bucket_id: str
    evidences: List[ConflictEvidence]
    status: ConflictStatus = ConflictStatus.PENDING
    handler: Optional[str] = None
    handle_time: Optional[datetime] = None
    handle_comment: Optional[str] = None
