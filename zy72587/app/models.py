from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class RecordStatus(str, Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    FEATURE_MISSING_DEFAULT = "feature_missing_default"
    PENDING_REVIEW = "pending_review"
    CONFLICT = "conflict"


class CheckStep(str, Enum):
    STEP1_IMPORT = "step1_import"
    STEP2_REVIEW_NEGATIVES = "step2_review_negatives"
    STEP3_UPDATE_SUMMARY = "step3_update_summary"


class ConflictResolution(str, Enum):
    CONFIRM = "confirm"
    REJECT = "reject"
    PENDING = "pending"


class StatusChangeEvent(BaseModel):
    event_time: datetime
    from_status: Optional[str] = None
    to_status: str
    triggered_by: str
    trigger_step: str
    reason: str
    parameter_version: Optional[str] = None
    extra_info: Optional[str] = None


class FeatureRecord(BaseModel):
    feature_id: str
    feature_name: str
    bucket_id: str
    sample_id: str
    feature_value: Optional[float] = None
    original_feature_value: Optional[float] = None
    default_value_used: bool = False
    default_filled_value: Optional[float] = 0.0
    time_window_start: datetime
    time_window_end: datetime
    feature_timestamp: Optional[datetime] = None
    is_leakage: Optional[bool] = None
    status: RecordStatus = RecordStatus.NORMAL
    notes: Optional[str] = None
    result_explanation: Optional[str] = None
    parameter_version_applied: Optional[str] = None
    status_history: List[StatusChangeEvent] = []


class ConflictEvidence(BaseModel):
    record_id: str
    sample_id: str
    feature_id: str
    feature_name: str = ""
    conflict_type: str = "value_mismatch"
    bucket_value: Any
    negative_value: Any
    description: str
    resolution: ConflictResolution = ConflictResolution.PENDING
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    status_history: List[StatusChangeEvent] = []


class CheckParameters(BaseModel):
    time_window_gap_hours: int = Field(default=24, description="时间窗口间隔小时数")
    leakage_threshold_ratio: float = Field(default=0.8, description="穿越判定阈值比例")
    default_fill_strategy: str = Field(default="zero", description="默认填充策略")
    default_fill_value: float = Field(default=0.0, description="默认填充数值")
    parameter_version: str = Field(default="v1.0", description="参数版本")
    rationale: str = Field(default="基于历史实验数据，24小时间隔可有效避免特征穿越", description="参数取舍理由")


class SelfCheckResult(BaseModel):
    check_type: str
    passed: bool
    details: str
    found_issues: int = 0
    checked_at: Optional[datetime] = None


class CheckSession(BaseModel):
    session_id: str
    created_at: datetime
    created_by: str = "xiaomeng"
    current_step: CheckStep = CheckStep.STEP1_IMPORT
    bucket_records: List[FeatureRecord] = []
    negative_records: List[FeatureRecord] = []
    conflicts: List[ConflictEvidence] = []
    parameters: CheckParameters = CheckParameters()
    self_check_results: List[SelfCheckResult] = []
    summary: Optional[str] = None
    is_locked: bool = False
    reviewer: Optional[str] = None
    operation_log: List[StatusChangeEvent] = []
