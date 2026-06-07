from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class RecordStatus(str, Enum):
    NORMAL = "normal"
    MANUAL_CORRECTED = "manual_corrected"
    OVERWRITTEN = "overwritten"
    SUPPLEMENTED = "supplemented"
    CONFLICT = "conflict"
    PENDING_REVIEW = "pending_review"


class RecordSource(str, Enum):
    MODEL_OUTPUT = "model_output"
    MANUAL_CORRECTION = "manual_correction"
    SUPPLEMENT = "supplement"
    MERGED = "merged"


@dataclass
class ManualCorrection:
    correction_id: str
    faq_id: str
    original_question: str
    original_answer: str
    corrected_question: str
    corrected_answer: str
    remark: str
    operator: str
    correction_time: datetime
    batch_id: str
    is_overwritten: bool = False
    overwritten_by_batch: Optional[str] = None
    overwritten_time: Optional[datetime] = None


@dataclass
class ConflictEvidence:
    faq_id: str
    field_name: str
    model_value: str
    manual_value: str
    model_source: str
    manual_source: str
    model_time: datetime
    manual_time: datetime
    description: str


@dataclass
class FAQRecord:
    faq_id: str
    question: str
    answer: str
    source: RecordSource
    status: RecordStatus
    create_time: datetime
    update_time: datetime
    batch_id: str
    model_output_snippet: Optional[str] = None
    manual_correction: Optional[ManualCorrection] = None
    remarks: List[str] = field(default_factory=list)
    history: List[Dict[str, Any]] = field(default_factory=list)
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    review_required: bool = False
    reviewed_by: Optional[str] = None
    reviewed_time: Optional[datetime] = None

    def add_history(self, action: str, operator: str, detail: str):
        self.history.append({
            "action": action,
            "operator": operator,
            "detail": detail,
            "time": datetime.now().isoformat(),
        })
        self.update_time = datetime.now()

    def add_remark(self, remark: str):
        self.remarks.append(remark)
        self.update_time = datetime.now()


@dataclass
class EvaluationReport:
    report_id: str
    batch_id: str
    generate_time: datetime
    total_records: int = 0
    normal_count: int = 0
    manual_corrected_count: int = 0
    overwritten_count: int = 0
    supplemented_count: int = 0
    conflict_count: int = 0
    pending_review_count: int = 0
    details: List[Dict[str, Any]] = field(default_factory=list)
    summary: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "batch_id": self.batch_id,
            "generate_time": self.generate_time.isoformat(),
            "statistics": {
                "total_records": self.total_records,
                "normal_count": self.normal_count,
                "manual_corrected_count": self.manual_corrected_count,
                "overwritten_count": self.overwritten_count,
                "supplemented_count": self.supplemented_count,
                "conflict_count": self.conflict_count,
                "pending_review_count": self.pending_review_count,
            },
            "details": self.details,
            "summary": self.summary,
        }
