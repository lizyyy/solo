from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class StatusEnum(str, Enum):
    STEP1_IMPORTED = "step1_imported"
    STEP2_FEATURE_ADDED = "step2_feature_added"
    STEP3_THRESHOLD_UPDATED = "step3_threshold_updated"
    PENDING_REVIEW = "pending_review"
    CONFIRMED_NORMAL = "confirmed_normal"
    CONFIRMED_ABNORMAL = "confirmed_abnormal"
    ROLLBACK = "rollback"


class SampleTypeEnum(str, Enum):
    MINORITY = "少数类"
    MAJORITY = "多数类"


class EvaluationSliceCreate(BaseModel):
    slice_name: str = Field(..., description="评测切片名称")
    description: Optional[str] = None
    imported_by: str = "system"


class EvaluationSliceResponse(BaseModel):
    id: int
    slice_name: str
    import_time: datetime
    imported_by: str
    total_count: int
    abnormal_count: int
    description: Optional[str]

    class Config:
        from_attributes = True


class ReconciliationRecordBase(BaseModel):
    original_row_number: int
    sample_id: Optional[str] = None
    sample_type: Optional[str] = None
    is_minority: bool = False
    recall_rate: Optional[float] = None
    precision_rate: Optional[float] = None
    total_metric: Optional[float] = None


class ReconciliationRecordImport(ReconciliationRecordBase):
    pass


class ReconciliationRecordResponse(BaseModel):
    id: int
    slice_id: int
    original_row_number: int
    sample_id: Optional[str]
    sample_type: Optional[str]
    is_minority: bool
    recall_rate: Optional[float]
    precision_rate: Optional[float]
    total_metric: Optional[float]
    feature_snapshot_id: Optional[str]
    feature_snapshot_added_by: Optional[str]
    feature_snapshot_added_time: Optional[datetime]
    threshold_value: Optional[float]
    threshold_replay_result: Optional[str]
    threshold_updated_by: Optional[str]
    threshold_updated_time: Optional[datetime]
    is_masked_by_total: bool
    status: str
    manual_note: Optional[str]
    reviewed_by: Optional[str]
    reviewed_time: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class FeatureSnapshotUpdate(BaseModel):
    feature_snapshot_id: str
    operator: str
    note: Optional[str] = None


class ThresholdReplayUpdate(BaseModel):
    threshold_value: float
    threshold_replay_result: str
    operator: str
    note: Optional[str] = None


class ManualReviewUpdate(BaseModel):
    status: StatusEnum
    reviewed_by: str
    manual_note: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: int
    record_id: int
    action: str
    previous_value: Optional[str]
    new_value: Optional[str]
    operator: str
    operation_time: datetime
    remark: Optional[str]

    class Config:
        from_attributes = True


class RecordDetailResponse(ReconciliationRecordResponse):
    audit_logs: List[AuditLogResponse]


class ImportResultResponse(BaseModel):
    slice_id: int
    slice_name: str
    total_records: int
    minority_count: int
    masked_by_total_count: int


class SliceImportRequest(BaseModel):
    slice_name: str = Field(..., description="评测切片名称")
    description: Optional[str] = None
    imported_by: str = "system"
    records: List[ReconciliationRecordImport]
