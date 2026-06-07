from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class VerificationStatus(str, Enum):
    PENDING_IMPORT = "pending_import"
    IMPORTED = "imported"
    MODEL_VERSION_CONFLICT = "model_version_conflict"
    PENDING_AI_PM_REVIEW = "pending_ai_pm_review"
    AI_PM_REVIEWED = "ai_pm_reviewed"
    PENDING_OPERATION_REVIEW = "pending_operation_review"
    OPERATION_APPROVED = "operation_approved"
    OPERATION_REJECTED = "operation_rejected"
    PENDING_REVIEW_PAGE_UPDATE = "pending_review_page_update"
    COMPLETED = "completed"
    ROLLBACKED = "rollbacked"


class ConflictType(str, Enum):
    NO_CONFLICT = "no_conflict"
    MODEL_VERSION_CHANGED_SAME_SAMPLE = "model_version_changed_same_sample"
    MANUAL_JUDGEMENT_DIFFERS = "manual_judgement_differs"
    BOTH_CONFLICT = "both_conflict"


class SampleRecord(BaseModel):
    sample_id: str
    model_version: str
    original_row_number: int
    model_output: str
    expected_summary: str
    fact_check_result: str
    raw_data: Dict[str, Any] = Field(default_factory=dict)
    imported_at: datetime = Field(default_factory=datetime.now)


class ManualJudgement(BaseModel):
    sample_id: str
    judge_row_number: int
    is_correct: bool
    corrected_summary: Optional[str] = None
    judge_comment: Optional[str] = None
    judged_by: str
    judged_at: datetime = Field(default_factory=datetime.now)
    raw_data: Dict[str, Any] = Field(default_factory=dict)


class VerificationRecord(BaseModel):
    id: str
    batch_id: str
    sample_id: str
    status: VerificationStatus
    conflict_type: ConflictType
    current_model_version: str
    previous_model_version: Optional[str] = None
    sample: SampleRecord
    manual_judgement: Optional[ManualJudgement] = None
    operation_review_comment: Optional[str] = None
    operation_reviewed_by: Optional[str] = None
    operation_reviewed_at: Optional[datetime] = None
    ai_pm_review_comment: Optional[str] = None
    ai_pm_reviewed_by: Optional[str] = None
    ai_pm_reviewed_at: Optional[datetime] = None
    status_history: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    def add_status_history(self, old_status: VerificationStatus, new_status: VerificationStatus,
                           operator: str, comment: str = ""):
        self.status_history.append({
            "old_status": old_status,
            "new_status": new_status,
            "operator": operator,
            "comment": comment,
            "timestamp": datetime.now().isoformat()
        })
        self.updated_at = datetime.now()


class BatchInfo(BaseModel):
    batch_id: str
    name: str
    model_version: str
    total_samples: int = 0
    created_by: str
    created_at: datetime = Field(default_factory=datetime.now)
    description: Optional[str] = None


class OperationLog(BaseModel):
    id: str
    batch_id: str
    sample_id: Optional[str] = None
    operation: str
    operator: str
    timestamp: datetime = Field(default_factory=datetime.now)
    details: Dict[str, Any] = Field(default_factory=dict)
