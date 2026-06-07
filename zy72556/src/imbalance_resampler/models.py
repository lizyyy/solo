from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator


class RecordStatus(str, Enum):
    IMPORTED = "imported"
    PENDING_REVIEW = "pending_review"
    REVIEWED_BY_AYUE = "reviewed_by_ayue"
    CONFIRMED_NORMAL = "confirmed_normal"
    NEEDS_RECHECK = "needs_recheck"
    EXCLUDED = "excluded"
    SUSPICIOUS_DEFAULT_SCORE = "suspicious_default_score"


class AuditAction(str, Enum):
    IMPORT = "import"
    STATUS_CHANGE = "status_change"
    MANUAL_EDIT = "manual_edit"
    REVIEW_COMMENT = "review_comment"
    SUMMARY_UPDATE = "summary_update"
    ROLLBACK = "rollback"


class FeatureSnapshot(BaseModel):
    snapshot_id: str
    original_line_number: int
    raw_data: Dict[str, Any]
    has_missing_features: bool = False
    missing_features: List[str] = Field(default_factory=list)
    used_default_score: bool = False
    default_score_reason: Optional[str] = None
    model_score: float
    true_label: Optional[int] = None
    predicted_label: Optional[int] = None

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class AuditLogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    action: AuditAction
    operator: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    comment: Optional[str] = None
    field_name: Optional[str] = None


class ResampleRecord(BaseModel):
    record_id: str
    snapshot: FeatureSnapshot
    current_status: RecordStatus = RecordStatus.IMPORTED
    manual_edits: Dict[str, Any] = Field(default_factory=dict)
    audit_log: List[AuditLogEntry] = Field(default_factory=list)
    training_log_curve_check: Optional[bool] = None
    ayue_review_note: Optional[str] = None
    explanation_summary: Optional[str] = None
    explanation_detail: Optional[str] = None
    final_weight: float = 1.0
    is_rollback_of: Optional[str] = None

    def add_audit_entry(
        self,
        action: AuditAction,
        operator: str,
        old_value: Any = None,
        new_value: Any = None,
        comment: str = None,
        field_name: str = None,
    ) -> None:
        self.audit_log.append(
            AuditLogEntry(
                action=action,
                operator=operator,
                old_value=old_value,
                new_value=new_value,
                comment=comment,
                field_name=field_name,
            )
        )

    def change_status(
        self,
        new_status: RecordStatus,
        operator: str,
        comment: str = None,
    ) -> None:
        old_status = self.current_status
        self.current_status = new_status
        self.add_audit_entry(
            action=AuditAction.STATUS_CHANGE,
            operator=operator,
            old_value=old_status,
            new_value=new_status,
            comment=comment,
        )

    def manual_edit(
        self,
        field_name: str,
        old_value: Any,
        new_value: Any,
        operator: str,
        comment: str = None,
    ) -> None:
        self.manual_edits[field_name] = new_value
        self.add_audit_entry(
            action=AuditAction.MANUAL_EDIT,
            operator=operator,
            old_value=old_value,
            new_value=new_value,
            comment=comment,
            field_name=field_name,
        )


class ResampleSession(BaseModel):
    session_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    created_by: str
    records: List[ResampleRecord] = Field(default_factory=list)
    config: Dict[str, Any] = Field(default_factory=dict)
    summary_stats: Dict[str, Any] = Field(default_factory=dict)

    def get_records_by_status(self, status: RecordStatus) -> List[ResampleRecord]:
        return [r for r in self.records if r.current_status == status]

    def get_suspicious_records(self) -> List[ResampleRecord]:
        return [
            r for r in self.records
            if r.snapshot.used_default_score and r.snapshot.has_missing_features
        ]
