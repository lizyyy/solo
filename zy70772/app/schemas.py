from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from app.models import FlagStatus, RiskLevel, ExperimentStatus, DeletionSuggestion


class CodeReferenceBase(BaseModel):
    file_path: str
    line_number: int
    code_snippet: Optional[str] = None
    language: Optional[str] = None
    repository: Optional[str] = None


class CodeReferenceCreate(CodeReferenceBase):
    pass


class CodeReference(CodeReferenceBase):
    id: int
    feature_flag_id: int
    found_at: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    processed_by: str
    conclusion: Optional[str] = None
    original_input: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    old_status: Optional[FlagStatus] = None
    new_status: Optional[FlagStatus] = None


class AuditLog(AuditLogBase):
    id: int
    feature_flag_id: int
    old_status: Optional[FlagStatus] = None
    new_status: Optional[FlagStatus] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FeatureFlagBase(BaseModel):
    name: str
    description: Optional[str] = None
    default_value: bool
    owner: Optional[str] = None
    notes: Optional[str] = None
    experiment_status: Optional[ExperimentStatus] = None


class FeatureFlagCreate(FeatureFlagBase):
    code_references: Optional[List[CodeReferenceCreate]] = None


class FeatureFlagUpdate(BaseModel):
    description: Optional[str] = None
    default_value: Optional[bool] = None
    owner: Optional[str] = None
    notes: Optional[str] = None
    experiment_status: Optional[ExperimentStatus] = None
    risk_level: Optional[RiskLevel] = None
    deletion_suggestion: Optional[DeletionSuggestion] = None


class FeatureFlag(FeatureFlagBase):
    id: int
    created_at: datetime
    updated_at: datetime
    status: FlagStatus
    risk_level: Optional[RiskLevel] = None
    deletion_suggestion: Optional[DeletionSuggestion] = None
    code_references: List[CodeReference] = []
    audit_logs: List[AuditLog] = []

    class Config:
        from_attributes = True


class StatusUpdateRequest(BaseModel):
    new_status: FlagStatus
    processed_by: str
    conclusion: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    risk_level: Optional[RiskLevel] = None
    deletion_suggestion: Optional[DeletionSuggestion] = None
    processed_by: str
    notes: Optional[str] = None


class CleanupReportBase(BaseModel):
    generated_by: Optional[str] = None


class CleanupReport(CleanupReportBase):
    id: int
    report_date: datetime
    total_flags: int
    safe_to_delete: int
    needs_review: int
    do_not_delete: int
    high_risk: int
    file_path: Optional[str] = None

    class Config:
        from_attributes = True


class ScanResult(BaseModel):
    flag_id: int
    flag_name: str
    reference_count: int
    risk_level: RiskLevel
    deletion_suggestion: DeletionSuggestion
