from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any
from enum import Enum

from ..utils.helpers import generate_id, get_current_time


class OperationType(str, Enum):
    IMPORT_CANDIDATES = "import_candidates"
    LOAD_PARAMS = "load_params"
    UPDATE_THRESHOLD = "update_threshold"
    CONFIRM_CONFLICT = "confirm_conflict"
    REJECT_CONFLICT = "reject_conflict"
    RECALCULATE = "recalculate"
    EXPORT = "export"
    REVIEW = "review"
    UPDATE_METRICS = "update_metrics"
    ADD_COMMENT = "add_comment"


@dataclass
class AuditLog:
    """审计日志，记录谁在什么时候做了什么"""
    operation_type: OperationType
    operator: str
    log_id: str = field(default_factory=lambda: generate_id("log"))
    patch_id: str = ""
    timestamp: datetime = field(default_factory=get_current_time)
    details: Dict[str, Any] = field(default_factory=dict)
    before_state: Dict[str, Any] = field(default_factory=dict)
    after_state: Dict[str, Any] = field(default_factory=dict)
    reason: str = ""

    def get_change_summary(self) -> str:
        """获取变更摘要"""
        changes = []
        for key in set(list(self.before_state.keys()) + list(self.after_state.keys())):
            before = self.before_state.get(key)
            after = self.after_state.get(key)
            if before != after:
                changes.append(f"{key}: {before} -> {after}")
        return "; ".join(changes) if changes else "无变更"
