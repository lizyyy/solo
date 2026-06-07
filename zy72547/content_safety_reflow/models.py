from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ReflowStatus(str, Enum):
    PENDING = "pending"
    MODEL_IMPORTED = "model_imported"
    MANUAL_SUPPLEMENTED = "manual_supplemented"
    COVERED_PENDING_REVIEW = "covered_pending_review"
    REVIEW_APPROVED = "review_approved"
    REPORT_UPDATED = "report_updated"
    ROLLBACKED = "rollbacked"
    ABNORMAL = "abnormal"


class ManualChangeType(str, Enum):
    LABEL_CHANGE = "label_change"
    EVIDENCE_ADD = "evidence_add"
    EVIDENCE_MODIFY = "evidence_modify"
    REMARK_ADD = "remark_add"


class ModelOutput(BaseModel):
    model_config = ConfigDict(frozen=False, protected_namespaces=())

    sample_id: str
    original_line_number: int
    batch_id: str
    model_version: str
    content: str
    predicted_label: str
    confidence: float
    risk_tags: List[str] = Field(default_factory=list)
    evidence_snippets: List[str] = Field(default_factory=list)
    import_time: datetime = Field(default_factory=datetime.now)
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class ManualJudgment(BaseModel):
    model_config = ConfigDict(frozen=False)

    sample_id: str
    judgment_id: str
    judge_person: str
    judgment_time: datetime
    final_label: str
    on_site_statement: str
    change_type: ManualChangeType
    changed_fields: List[str] = Field(default_factory=list)
    original_values: Dict[str, Any] = Field(default_factory=dict)
    new_values: Dict[str, Any] = Field(default_factory=dict)
    remarks: Optional[str] = None
    is_overridden: bool = False
    override_batch_id: Optional[str] = None
    override_time: Optional[datetime] = None


class ChangeLogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    operator: str
    action: str
    field_name: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    reason: Optional[str] = None


class UnifiedResult(BaseModel):
    model_config = ConfigDict(frozen=False, protected_namespaces=())

    sample_id: str
    status: ReflowStatus
    model_output: Optional[ModelOutput] = None
    manual_judgments: List[ManualJudgment] = Field(default_factory=list)
    active_manual_judgment: Optional[ManualJudgment] = None
    is_covered: bool = False
    covered_by_batch_id: Optional[str] = None
    current_label: Optional[str] = None
    final_evidence: List[str] = Field(default_factory=list)
    change_history: List[ChangeLogEntry] = Field(default_factory=list)
    last_updated: datetime = Field(default_factory=datetime.now)
    review_person: Optional[str] = None
    review_time: Optional[datetime] = None


class EvaluationReportItem(BaseModel):
    sample_id: str
    label: str
    source: str
    evidence_count: int
    status: str
    has_manual_judgment: bool
    is_covered: bool


class EvaluationReport(BaseModel):
    report_id: str
    version: int
    generated_time: datetime
    generated_by: str
    total_samples: int
    label_distribution: Dict[str, int] = Field(default_factory=dict)
    items: List[EvaluationReportItem] = Field(default_factory=list)
    parent_report_id: Optional[str] = None
