from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class AuditStatus(Enum):
    IMPORTED = "已导入"
    SNAPSHOT_CHECKED = "快照已核验"
    NORMAL = "正常"
    DUPLICATE_TRAINING = "重复训练待复核"
    WRONG_CALIBER = "口径错误"
    SUPPLEMENTED = "补录旧口径"
    PRODUCT_REVIEW = "策略产品复核中"
    CORRECTED = "已人工修正"
    RERUN = "已重跑"
    COMPLETED = "已完成"


class RecordSource(Enum):
    NORMAL_IMPORT = "正常导入"
    SUPPLEMENT = "快照补录"


@dataclass
class EvalSlice:
    slice_id: str
    slice_name: str
    data_batch_id: str
    import_time: datetime
    feature_snapshot_id: Optional[str] = None
    caliber_version: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FeatureSnapshot:
    snapshot_id: str
    feature_name: str
    caliber_version: str
    create_time: datetime
    default_value: Any
    is_current: bool = True
    description: str = ""


@dataclass
class FeatureVersion:
    version_id: str
    feature_name: str
    caliber_version: str
    default_value: Any
    effective_time: datetime
    is_active: bool = True
    source_slice_id: Optional[str] = None
    source_snapshot_id: Optional[str] = None
    remark: str = ""


@dataclass
class AuditHistory:
    history_id: str
    slice_id: str
    operation: str
    operator: str
    operate_time: datetime
    before_status: Optional[AuditStatus] = None
    after_status: Optional[AuditStatus] = None
    detail: Dict[str, Any] = field(default_factory=dict)
    remark: str = ""


@dataclass
class CorrectionRecord:
    correction_id: str
    slice_id: str
    operator: str
    correct_time: datetime
    original_snapshot_id: str
    corrected_snapshot_id: str
    reason: str
    detail: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuditRecord:
    slice_id: str
    eval_slice: EvalSlice
    current_status: AuditStatus
    source: RecordSource
    feature_snapshots: List[FeatureSnapshot] = field(default_factory=list)
    history: List[AuditHistory] = field(default_factory=list)
    corrections: List[CorrectionRecord] = field(default_factory=list)
    feature_versions: List[FeatureVersion] = field(default_factory=list)
    is_duplicate_training: bool = False
    duplicate_with_slice: Optional[str] = None
    supplement_from_snapshot: Optional[str] = None
