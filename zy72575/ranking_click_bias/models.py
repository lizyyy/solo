"""
核心数据模型定义
"""
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
import uuid


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    IMPORTED = "imported"
    LOGS_REVIEWED = "logs_reviewed"
    SUMMARY_UPDATED = "summary_updated"
    NEEDS_REVIEW = "needs_review"
    REVIEW_APPROVED = "review_approved"
    REVIEW_REJECTED = "review_rejected"
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    ROLLED_BACK = "rolled_back"


class BoundaryRuleType(str, Enum):
    MISSING_FEATURE_DEFAULT_SCORE = "missing_feature_default_score"
    CLICK_BIAS_INCONSISTENT = "click_bias_inconsistent"
    FEATURE_SNAPSHOT_MISMATCH = "feature_snapshot_mismatch"
    CUSTOM = "custom"


class WorkflowStep(str, Enum):
    STEP_1_IMPORT = "step_1_import"
    STEP_2_REVIEW_LOGS = "step_2_review_logs"
    STEP_3_UPDATE_SUMMARY = "step_3_update_summary"


class WorkflowState(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"


@dataclass
class SnapshotRecord:
    snapshot_id: str
    original_line_number: int
    raw_data: Dict[str, Any]
    imported_at: datetime = field(default_factory=datetime.now)
    import_batch_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: ProcessingStatus = ProcessingStatus.PENDING
    notes: str = ""
    click_bias_score: Optional[float] = None
    default_score_applied: bool = False
    missing_features: List[str] = field(default_factory=list)
    assigned_to: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    workflow_step: WorkflowStep = WorkflowStep.STEP_1_IMPORT
    workflow_state: WorkflowState = WorkflowState.NOT_STARTED
    custom_fields: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["imported_at"] = self.imported_at.isoformat() if self.imported_at else None
        data["reviewed_at"] = self.reviewed_at.isoformat() if self.reviewed_at else None
        data["status"] = self.status.value
        data["workflow_step"] = self.workflow_step.value
        data["workflow_state"] = self.workflow_state.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SnapshotRecord":
        data = data.copy()
        if "imported_at" in data and data["imported_at"]:
            data["imported_at"] = datetime.fromisoformat(data["imported_at"])
        if "reviewed_at" in data and data["reviewed_at"]:
            data["reviewed_at"] = datetime.fromisoformat(data["reviewed_at"])
        if "status" in data:
            data["status"] = ProcessingStatus(data["status"])
        if "workflow_step" in data:
            data["workflow_step"] = WorkflowStep(data["workflow_step"])
        if "workflow_state" in data:
            data["workflow_state"] = WorkflowState(data["workflow_state"])
        return cls(**data)


@dataclass
class BoundaryRule:
    rule_type: BoundaryRuleType
    name: str
    description: str
    condition: str
    action: str
    rule_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    rollback_action: Optional[str] = None
    enabled: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = "system"

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        data["rule_type"] = self.rule_type.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BoundaryRule":
        data = data.copy()
        if "created_at" in data and data["created_at"]:
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        if "rule_type" in data:
            data["rule_type"] = BoundaryRuleType(data["rule_type"])
        return cls(**data)


@dataclass
class ChangeRecord:
    snapshot_id: str
    field_name: str
    old_value: Any
    new_value: Any
    changed_by: str
    change_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    changed_at: datetime = field(default_factory=datetime.now)
    change_reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["changed_at"] = self.changed_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChangeRecord":
        data = data.copy()
        if "changed_at" in data and data["changed_at"]:
            data["changed_at"] = datetime.fromisoformat(data["changed_at"])
        return cls(**data)


@dataclass
class AuditTrail:
    snapshot_id: str
    action: str
    actor: str
    audit_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    details: Dict[str, Any] = field(default_factory=dict)
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuditTrail":
        data = data.copy()
        if "timestamp" in data and data["timestamp"]:
            data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return cls(**data)
