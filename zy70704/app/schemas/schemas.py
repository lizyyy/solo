from datetime import datetime
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field, validator


class BatchStatus(str, Enum):
    PENDING = "pending"
    APPROVING = "approving"
    APPROVED = "approved"
    PROCESSING = "processing"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    ROLLBACKED = "rollbacked"


class GapType(str, Enum):
    MISSING = "missing"
    CORRUPTED = "corrupted"
    ANOMALY = "anomaly"


class SourceType(str, Enum):
    LOG_REPLAY = "log_replay"
    HISTORY_RESTORE = "history_restore"
    MANUAL_FIX = "manual_fix"
    ALGORITHM_PREDICT = "algorithm_predict"


class OverrideStrategy(str, Enum):
    PROTECT = "protect"
    MERGE = "merge"
    FORCE = "force"


class GrayBatchBase(BaseModel):
    batch_code: str = Field(..., description="批次唯一编码")
    batch_name: str = Field(..., description="批次名称")
    description: Optional[str] = Field(None, description="描述")
    override_strategy: OverrideStrategy = Field(OverrideStrategy.PROTECT, description="覆盖策略")


class GrayBatchCreate(GrayBatchBase):
    created_by: str = Field(..., description="创建人")


class GrayBatchUpdate(BaseModel):
    batch_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[BatchStatus] = None
    override_strategy: Optional[OverrideStrategy] = None


class MetricWindowBase(BaseModel):
    metric_name: str = Field(..., description="指标名称")
    window_start: datetime = Field(..., description="窗口开始时间")
    window_end: datetime = Field(..., description="窗口结束时间")
    tags: Optional[str] = Field(None, description="标签JSON")

    @validator("window_end")
    def validate_window_end(cls, v, values):
        if "window_start" in values and v <= values["window_start"]:
            raise ValueError("窗口结束时间必须大于开始时间")
        return v


class MetricWindowCreate(MetricWindowBase):
    batch_id: int = Field(..., description="关联批次ID")


class GapSegmentBase(BaseModel):
    gap_type: GapType = Field(..., description="缺口类型")
    gap_start: datetime = Field(..., description="缺口开始时间")
    gap_end: datetime = Field(..., description="缺口结束时间")
    expected_points: Optional[int] = Field(None, description="预期数据点数量")
    actual_points: Optional[int] = Field(None, description="实际数据点数量")


class GapSegmentCreate(GapSegmentBase):
    metric_window_id: int = Field(..., description="关联指标窗口ID")


class BackfillSourceBase(BaseModel):
    source_type: SourceType = Field(..., description="回填来源类型")
    source_name: str = Field(..., description="来源名称")
    source_config: Optional[str] = Field(None, description="来源配置JSON")
    data_hash: Optional[str] = Field(None, description="数据哈希")
    record_count: Optional[int] = Field(None, description="记录数量")


class BackfillSourceCreate(BackfillSourceBase):
    gap_segment_id: int = Field(..., description="关联缺口片段ID")


class AuditRecordBase(BaseModel):
    to_status: BatchStatus = Field(..., description="目标状态")
    operator: str = Field(..., description="操作人")
    comment: Optional[str] = Field(None, description="审核意见")


class AuditRecordCreate(AuditRecordBase):
    batch_id: int = Field(..., description="批次ID")
    from_status: Optional[BatchStatus] = Field(None, description="原状态")


class ExceptionLogBase(BaseModel):
    operation: str = Field(..., description="操作类型")
    original_input: Optional[str] = Field(None, description="原始输入JSON")
    error_message: Optional[str] = Field(None, description="错误信息")


class ExceptionLogCreate(ExceptionLogBase):
    batch_id: Optional[int] = Field(None, description="关联批次ID")
    handler: Optional[str] = Field(None, description="处理人")
    conclusion: Optional[str] = Field(None, description="处理结论")


class StatusTransitionRequest(BaseModel):
    target_status: BatchStatus = Field(..., description="目标状态")
    operator: str = Field(..., description="操作人")
    comment: Optional[str] = Field(None, description="备注")


class ManualCorrectionRequest(BaseModel):
    gap_segment_id: int = Field(..., description="缺口片段ID")
    corrected_data: str = Field(..., description="修正后数据JSON")
    operator: str = Field(..., description="操作人")
    reason: str = Field(..., description="修正原因")


class BackfillSourceResponse(BackfillSourceBase):
    id: int
    gap_segment_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class GapSegmentResponse(GapSegmentBase):
    id: int
    metric_window_id: int
    fill_rate: Optional[float]
    is_backfilled: bool
    backfilled_at: Optional[datetime]
    created_at: datetime
    backfill_sources: List[BackfillSourceResponse] = []

    class Config:
        from_attributes = True


class MetricWindowResponse(MetricWindowBase):
    id: int
    batch_id: int
    created_at: datetime
    gap_segments: List[GapSegmentResponse] = []

    class Config:
        from_attributes = True


class AuditRecordResponse(AuditRecordBase):
    id: int
    batch_id: int
    from_status: Optional[BatchStatus]
    audit_time: datetime

    class Config:
        from_attributes = True


class ResultSnapshotResponse(BaseModel):
    id: int
    batch_id: int
    snapshot_type: str
    snapshot_data: str
    snapshot_hash: Optional[str]
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionLogResponse(ExceptionLogBase):
    id: int
    batch_id: Optional[int]
    handler: Optional[str]
    conclusion: Optional[str]
    handled_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class GrayBatchResponse(GrayBatchBase):
    id: int
    created_by: str
    status: BatchStatus
    created_at: datetime
    updated_at: Optional[datetime]
    metric_windows: List[MetricWindowResponse] = []
    audit_records: List[AuditRecordResponse] = []
    result_snapshots: List[ResultSnapshotResponse] = []

    class Config:
        from_attributes = True
