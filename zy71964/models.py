from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from uuid import uuid4


class RollbackStatus(str, Enum):
    PENDING = "待确认"
    SUCCESS = "回滚成功"
    FAILED = "回滚失败"
    ABNORMAL = "异常待确认"


class AbnormalType(str, Enum):
    METRIC_CHANGED = "指标口径变化"
    DATA_LEAKAGE = "训练集泄漏"
    LABEL_MISSING = "标签漏映射"


@dataclass
class MaterialInfo:
    material_id: str
    name: str
    version: str
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingLog:
    log_id: str
    material_id: str
    version: str
    metrics: Dict[str, float]
    feature_stats: Dict[str, Any]
    label_mapping: Dict[str, str]
    training_set_ids: List[str]
    created_at: datetime = field(default_factory=datetime.now)
    uploaded_at: datetime = field(default_factory=datetime.now)

    def content_hash(self) -> str:
        import hashlib
        import json
        content = json.dumps({
            "metrics": self.metrics,
            "feature_stats": self.feature_stats,
            "label_mapping": self.label_mapping,
            "training_set_ids": sorted(self.training_set_ids),
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


@dataclass
class ThresholdConfig:
    metric_name: str
    threshold: float
    min_coverage: float = 0.8
    operator: str = ">="


@dataclass
class AbnormalInfo:
    abnormal_type: AbnormalType
    description: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RollbackRecord:
    record_id: str = field(default_factory=lambda: str(uuid4()))
    material_id: str = ""
    material_name: str = ""
    log_id: str = ""
    log_version: str = ""
    status: RollbackStatus = RollbackStatus.PENDING
    threshold_configs: List[ThresholdConfig] = field(default_factory=list)
    original_thresholds: Dict[str, float] = field(default_factory=dict)
    new_thresholds: Dict[str, float] = field(default_factory=dict)
    grayscale_result: Dict[str, Any] = field(default_factory=dict)
    abnormalities: List[AbnormalInfo] = field(default_factory=list)
    human_message: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    is_historical: bool = False
    previous_record_id: Optional[str] = None
    version_changes: Optional[Dict[str, Any]] = None


@dataclass
class UserFriendlyError:
    error_code: str
    title: str
    message: str
    suggestion: str
    details: Dict[str, Any] = field(default_factory=dict)
    abnormal_type: Optional[AbnormalType] = None
