from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TodoExtractBase(BaseModel):
    meeting_id: str
    meeting_title: str
    todo_content: str
    assignee: Optional[str] = None
    deadline: Optional[str] = None
    priority: Optional[str] = None
    desensitization_level: Optional[str] = None
    desensitization_note: Optional[str] = None
    gray_batch_id: Optional[int] = None
    source_version: Optional[str] = None
    import_batch_id: Optional[str] = None


class TodoExtractCreate(TodoExtractBase):
    pass


class TodoExtractUpdate(BaseModel):
    status: Optional[str] = None
    desensitization_level: Optional[str] = None
    desensitization_note: Optional[str] = None
    gray_batch_id: Optional[int] = None
    is_manual_judgment: Optional[bool] = None
    manual_judgment_reason: Optional[str] = None
    needs_security_review: Optional[bool] = None
    security_review_status: Optional[str] = None
    security_review_note: Optional[str] = None


class TodoExtractResponse(TodoExtractBase):
    id: int
    status: str
    is_manual_judgment: bool
    manual_judgment_by: Optional[str] = None
    manual_judgment_at: Optional[datetime] = None
    is_overridden_by_batch: bool
    overridden_by_batch_id: Optional[int] = None
    needs_security_review: bool
    security_review_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConflictEvidence(BaseModel):
    todo_id: int
    todo_content: str
    rule_id: int
    rule_name: str
    rule_level: str
    rule_note: str
    batch_id: int
    batch_name: str
    batch_level: str
    batch_note: str
    contradiction_point: str


class ConflictRecordResponse(BaseModel):
    id: int
    rule_id: int
    batch_id: int
    todo_id: int
    conflict_type: str
    rule_value: str
    batch_value: str
    description: str
    evidence: Dict[str, Any]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConflictResolveRequest(BaseModel):
    resolution: str = Field(description="confirm or reject")
    resolution_note: Optional[str] = None
    operator: str


class ManualJudgmentRequest(BaseModel):
    todo_id: int
    judge_by: str
    changes: Dict[str, Any]
    reason: str


class SelfCheckResultResponse(BaseModel):
    id: int
    check_type: str
    check_name: str
    status: str
    issues_found: int
    details: Dict[str, Any]
    checked_at: datetime

    class Config:
        from_attributes = True


class GrayBatchCreate(BaseModel):
    batch_name: str
    batch_code: str
    model_version: str
    gray_ratio: float
    expected_desensitization_level: str
    note: Optional[str] = None
    created_by: str


class GrayBatchReviewRequest(BaseModel):
    reviewed_by: str
    review_note: Optional[str] = None
    status: str = "reviewed"


class DesensitizationRuleCreate(BaseModel):
    rule_name: str
    rule_type: str
    match_pattern: str
    desensitization_level: str
    note: Optional[str] = None
    version: str
    import_batch_id: Optional[str] = None
    created_by: str


class ImportBatchResponse(BaseModel):
    id: int
    batch_id: str
    import_type: str
    record_count: int
    duplicate_count: int
    imported_by: str
    imported_at: datetime
    status: str

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    todo_id: int
    action: str
    actor: str
    changed_fields: List[str]
    old_value: Dict[str, Any]
    new_value: Dict[str, Any]
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
