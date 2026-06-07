from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class RecordSource(str, Enum):
    RESIDENT_OPINION = "居民意见"
    GRID_INSPECTION = "网格员巡查表"
    REDLINE_REMARK = "红线图备注"
    SUPPLEMENT = "补录材料"


class RecordStatus(str, Enum):
    NORMAL = "正常"
    PENDING_REVIEW = "待社区书记复核"
    CONFLICT = "存在冲突"
    CONFIRMED = "已确认"
    REJECTED = "已驳回"
    SUPPLEMENTED = "已补录"


class RiskLevel(str, Enum):
    LOW = "低风险"
    MEDIUM = "中风险"
    HIGH = "高风险"


@dataclass
class ResidentOpinion:
    opinion_id: str
    summary: str
    original_text: Optional[str] = None
    has_original: bool = True
    submit_time: datetime = field(default_factory=datetime.now)


@dataclass
class GridInspection:
    inspection_id: str
    inspector: str
    location: str
    risk_description: str
    risk_level: RiskLevel
    inspection_time: datetime
    is_old_caliber: bool = False


@dataclass
class RedlineRemark:
    remark_id: str
    redline_version: str
    location: str
    risk_description: str
    risk_level: RiskLevel
    import_time: datetime


@dataclass
class ProfessionalCalc:
    calc_id: str
    calc_name: str
    param_version: str
    params: Dict[str, Any]
    result: Any
    trade_off_reason: str
    calc_time: datetime


@dataclass
class ConflictEvidence:
    evidence_id: str
    field_name: str
    source_a: RecordSource
    value_a: str
    source_b: RecordSource
    value_b: str
    description: str


@dataclass
class ProcessingStep:
    step_name: str
    operator: str
    action: str
    remark: str
    step_time: datetime = field(default_factory=datetime.now)


@dataclass
class RiverbankRiskRecord:
    record_id: str
    location: str
    redline_remark: Optional[RedlineRemark] = None
    resident_opinion: Optional[ResidentOpinion] = None
    grid_inspection: Optional[GridInspection] = None
    professional_calcs: List[ProfessionalCalc] = field(default_factory=list)
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    status: RecordStatus = RecordStatus.NORMAL
    processing_history: List[ProcessingStep] = field(default_factory=list)
    final_risk_level: Optional[RiskLevel] = None
    final_description: Optional[str] = None


@dataclass
class ConflictReviewItem:
    review_id: str
    record_id: str
    location: str
    conflicts: List[ConflictEvidence]
    operator: str = "城更项目经理阿宁"
    decision: Optional[str] = None
    decision_remark: Optional[str] = None
    review_time: Optional[datetime] = None
