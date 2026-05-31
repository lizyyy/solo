"""数据模型定义"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, ConfigDict


class SampleStatus(str, Enum):
    """样本状态"""
    PENDING = "pending"
    ANNOTATED = "annotated"
    REVIEWING = "reviewing"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    NEEDS_CONFIRMATION = "needs_confirmation"
    ANOMALY = "anomaly"


class AnomalyType(str, Enum):
    """异常类型"""
    LABEL_MISSING = "label_missing"
    LABEL_MAPPING_MISSING = "label_mapping_missing"
    METRIC_CHANGED = "metric_changed"
    TRAIN_LEAKAGE = "train_leakage"
    DUPLICATE_SAMPLE = "duplicate_sample"
    VERSION_CONFLICT = "version_conflict"
    INCONSISTENT_ANNOTATION = "inconsistent_annotation"


class ChangeType(str, Enum):
    """变更类型"""
    LABEL_CHANGED = "label_changed"
    METADATA_CHANGED = "metadata_changed"
    SCORE_CHANGED = "score_changed"
    NEW_SAMPLE = "new_sample"
    REMOVED_SAMPLE = "removed_sample"


class Label(BaseModel):
    """标签定义"""
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    category: Optional[str] = None


class LabelMapping(BaseModel):
    """标签映射规则"""
    source_label: str
    target_label: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    created_at: datetime = Field(default_factory=datetime.now)


class SampleMeta(BaseModel):
    """样本元数据"""
    split: Optional[str] = None
    source: Optional[str] = None
    collection_date: Optional[datetime] = None
    confidence: Optional[float] = None
    annotator: Optional[str] = None
    metrics: Dict[str, Any] = Field(default_factory=dict)


class AnnotationSample(BaseModel):
    """标注样本"""
    model_config = ConfigDict(extra="allow")
    
    sample_id: str
    content: Dict[str, Any]
    labels: List[str] = Field(default_factory=list)
    meta: SampleMeta = Field(default_factory=SampleMeta)
    status: SampleStatus = SampleStatus.PENDING
    anomalies: List[AnomalyType] = Field(default_factory=list)
    anomaly_details: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class AnnotationVersion(BaseModel):
    """标注版本"""
    version_id: str
    name: str
    description: Optional[str] = None
    metric_schema: Dict[str, Any] = Field(default_factory=dict)
    label_mappings: List[LabelMapping] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    sample_count: int = 0


class ChangeRecord(BaseModel):
    """变更记录"""
    sample_id: str
    change_type: ChangeType
    field: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    explanation: str


class VersionDiff(BaseModel):
    """版本对比结果"""
    base_version: str
    target_version: str
    total_changes: int
    changes: List[ChangeRecord]
    new_samples: List[str]
    removed_samples: List[str]
    summary: Dict[str, int]


class ReviewLog(BaseModel):
    """复核日志"""
    log_id: str
    sample_id: str
    reviewer: Optional[str] = None
    old_status: SampleStatus
    new_status: SampleStatus
    old_labels: List[str] = Field(default_factory=list)
    new_labels: List[str] = Field(default_factory=list)
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class ExportConfig(BaseModel):
    """导出配置"""
    include_history: bool = False
    include_anomalies: bool = True
    only_confirmed: bool = False
    format: str = "json"
    consistency_check: bool = True


class ExportResult(BaseModel):
    """导出结果"""
    total_samples: int
    exported_samples: int
    anomalies_included: int
    consistency_score: float
    file_path: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
