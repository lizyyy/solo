from __future__ import annotations
from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class RecordStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    DESENSITIZATION_REVIEWED = "desensitization_reviewed"
    PRODUCT_REVIEWED = "product_reviewed"
    NEEDS_RECHECK = "needs_recheck"
    ABNORMAL = "abnormal"
    NORMAL = "normal"


class AbnormalType(str, Enum):
    DUPLICATE_IMPORT = "duplicate_import"
    MODEL_VERSION_CHANGED = "model_version_changed"
    SUPPLEMENTARY_RECORD = "supplementary_record"
    DATA_INCONSISTENT = "data_inconsistent"


class WorkflowStep(str, Enum):
    STEP1_IMPORT = "step1_import"
    STEP2_DESENSITIZATION = "step2_desensitization"
    STEP3_PRODUCT = "step3_product"
    COMPLETED = "completed"


class FeedbackTicket(BaseModel):
    ticket_id: str
    original_line_no: int
    raw_content: str
    source_language: str
    target_language: str
    feedback_type: str
    reported_at: datetime
    reporter: str
    original_translation: str
    customer_text: str


class DesensitizationNote(BaseModel):
    note_id: str
    ticket_id: str
    rule_name: str
    rule_description: str
    reviewer: str
    reviewed_at: datetime
    is_desensitized: bool
    remark: str = ""


class ManualChange(BaseModel):
    change_id: str
    record_id: str
    field_name: str
    old_value: Any
    new_value: Any
    operator: str
    changed_at: datetime
    reason: str


class TranslationRecord(BaseModel):
    record_id: str
    sample_no: str
    model_version: str
    model_translation: str
    final_translation: str
    feedback_ticket: FeedbackTicket
    desensitization_note: Optional[DesensitizationNote] = None
    manual_changes: List[ManualChange] = Field(default_factory=list)
    status: RecordStatus = RecordStatus.PENDING_REVIEW
    current_step: WorkflowStep = WorkflowStep.STEP1_IMPORT
    abnormal_types: List[AbnormalType] = Field(default_factory=list)
    recheck_count: int = 0
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    imported_at: Optional[datetime] = None
    import_batch_no: str = ""


class ValidationIssue(BaseModel):
    issue_id: str
    record_id: str
    abnormal_type: AbnormalType
    severity: str
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)
    detected_at: datetime = Field(default_factory=datetime.now)
    resolved: bool = False


class EvidenceSummary(BaseModel):
    record_id: str
    sample_no: str
    model_version: str
    status: RecordStatus
    current_step: WorkflowStep
    abnormal_types: List[AbnormalType]
    original_line_no: int
    ticket_id: str
    has_manual_changes: bool
    manual_change_count: int
    has_desensitization_note: bool
    desensitization_reviewer: Optional[str] = None
    recheck_count: int
    feedback_summary: str
    desensitization_summary: Optional[str] = None


class ExportRecord(BaseModel):
    record_id: str
    sample_no: str
    model_version: str
    status: RecordStatus
    original_line_no: int
    ticket_id: str
    source_language: str
    target_language: str
    customer_text: str
    original_translation: str
    model_translation: str
    final_translation: str
    abnormal_types: List[str]
    has_manual_changes: bool
    desensitization_reviewed: bool
    imported_at: Optional[datetime]
    recheck_count: int


class WorkflowLog(BaseModel):
    log_id: str
    record_id: str
    from_step: WorkflowStep
    to_step: WorkflowStep
    operator: str
    action: str
    remark: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
