from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class DisposalType(str, Enum):
    NORMAL = "顺利记录"
    OVERRIDDEN = "人工改判被批跑覆盖"
    SUPPLEMENTED = "标注员留言补录旧口径"
    PENDING_REVIEW = "待安全审核复核"


class RiskLevel(str, Enum):
    LOW = "低风险"
    MEDIUM = "中风险"
    HIGH = "高风险"


@dataclass
class AnnotationMessage:
    annotator_id: str
    annotator_name: str
    message: str
    timestamp: datetime
    is_old_caliber: bool = False


@dataclass
class ManualCorrection:
    operator_id: str
    operator_name: str
    original_risk: RiskLevel
    corrected_risk: RiskLevel
    reason: str
    timestamp: datetime


@dataclass
class BatchRun:
    batch_id: str
    batch_name: str
    model_version: str
    run_time: datetime
    risk_level: RiskLevel
    confidence: float


@dataclass
class CostAttributionRecord:
    record_id: str
    content_id: str
    content_preview: str
    gray_batch_id: str
    gray_batch_name: str
    first_import_time: datetime
    
    disposal_type: Optional[DisposalType] = None
    final_risk_level: Optional[RiskLevel] = None
    
    batch_runs: List[BatchRun] = field(default_factory=list)
    annotation_messages: List[AnnotationMessage] = field(default_factory=list)
    manual_corrections: List[ManualCorrection] = field(default_factory=list)
    
    needs_security_review: bool = False
    review_note: str = ""
    
    history: List[str] = field(default_factory=list)
    
    def add_history(self, event: str):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.history.append(f"[{ts}] {event}")
