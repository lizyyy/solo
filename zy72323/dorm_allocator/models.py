from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class RecordStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    REVIEWING = "reviewing"
    VERIFIED = "verified"
    NEEDS_CORRECTION = "needs_correction"
    CORRECTED = "corrected"


class ReviewRole(str, Enum):
    DATA_CHECKER = "data_checker"
    TEACHING_RESEARCH_HEAD = "teaching_research_head"
    TEACHER = "teacher"


class FormulaSource(str, Enum):
    OLD_SCREENSHOT = "old_screenshot"
    CORRECTED = "corrected"
    LATEST = "latest"


class Annotation(BaseModel):
    id: str
    author_role: ReviewRole
    author_name: str
    content: str
    created_at: datetime = Field(default_factory=datetime.now)
    is_approved: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None


class AllocationRecord(BaseModel):
    id: str
    student_id: str
    student_name: str
    dorm_preference: str
    assigned_dorm: str
    numerator: float
    denominator: float
    result: Optional[float]
    result_display: str
    status: RecordStatus = RecordStatus.PENDING_REVIEW
    formula_source: FormulaSource = FormulaSource.OLD_SCREENSHOT
    annotations: List[Annotation] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    reviewed_by: Optional[str] = None
    review_note: Optional[str] = None
    run_id: str
    is_denominator_zero_issue: bool = False


class RunLog(BaseModel):
    run_id: str
    run_type: str
    started_at: datetime = Field(default_factory=datetime.now)
    finished_at: Optional[datetime] = None
    is_correction_run: bool = False
    previous_run_id: Optional[str] = None
    operator: str
    operator_role: ReviewRole
    record_count: int = 0
    issues_found: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class ClassroomDemoResult(BaseModel):
    record_id: str
    student_name: str
    assigned_dorm: str
    formula_used: str
    calculation: str
    result_value: Optional[float]
    result_display: str
    status: str
    status_explanation: str
    why_kept: str
    missing_materials: List[str]
    next_action: str
    next_contact: str
    annotations_summary: List[str]
