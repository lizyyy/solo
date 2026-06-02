from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class VerificationStatus(str, Enum):
    PASSED = "通过"
    NEED_MANUAL_CHECK = "待人工确认"
    FAILED = "不通过"
    OLD_CALIBER = "旧口径沿用"
    BORDERLINE = "边界记录"
    MISSING_DATA = "数据缺失"
    DUPLICATE = "重复记录"


class ConfidenceLevel(str, Enum):
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


class ChangeType(str, Enum):
    NEW_BUILDING = "新增建筑"
    DEMOLISHED = "拆除建筑"
    EXPANDED = "扩建"
    MODIFIED = "改建"
    NO_CHANGE = "无变化"
    UNKNOWN = "待判定"


class MaterialSource(str, Enum):
    EVAL_LOG = "评测日志"
    ANNOTATION_TABLE = "标注表"
    THRESHOLD_NOTE = "阈值备注"
    CONFLICT_CASE = "冲突案例"
    OLD_REPORT = "历史报告"


class EvaluationRecord(BaseModel):
    model_config = {'protected_namespaces': ()}
    record_id: str
    city: str
    district: str
    grid_id: str
    change_type: ChangeType
    confidence: ConfidenceLevel
    verify_status: VerificationStatus
    material_sources: List[MaterialSource] = Field(default_factory=list)
    has_missing_reference: bool = False
    missing_reference_note: Optional[str] = None
    threshold_applied: Optional[str] = None
    model_version: str
    eval_timestamp: datetime
    old_caliber_note: Optional[str] = None
    conflict_note: Optional[str] = None
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class AnnotationMaterial(BaseModel):
    material_id: str
    record_id: str
    source_type: MaterialSource
    content: str
    caliber_version: str
    is_active: bool = True
    created_at: datetime
    note: Optional[str] = None


class ModelVersion(BaseModel):
    version: str
    description: str
    created_at: datetime
    is_active: bool = True
    threshold_config: Dict[str, float] = Field(default_factory=dict)
    caliber_note: Optional[str] = None


class EvaluationReport(BaseModel):
    model_config = {'protected_namespaces': ()}
    report_id: str
    model_version: str
    created_at: datetime
    total_records: int
    stratified_summary: Dict[str, Dict[str, Any]]
    conflict_records: List[str]
    missing_reference_records: List[str]
    duplicate_records: List[str]
    borderline_records: List[str]
    recommendations: List[str]
    file_path: Optional[str] = None


class ConflictCase(BaseModel):
    case_id: str
    record_ids: List[str]
    description: str
    severity: str
    resolved: bool = False
    resolution_note: Optional[str] = None


class ThresholdConfig(BaseModel):
    version: str
    high_confidence: float = 0.85
    medium_confidence: float = 0.6
    borderline: float = 0.55
    change_type_weights: Dict[str, float] = Field(default_factory=dict)
