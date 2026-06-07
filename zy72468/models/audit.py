from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum
from pydantic import Field
from .base import BaseModel


class OperationType(str, Enum):
    IMPORT_NOTICE = "import_notice"
    SUPPLEMENT_RAMP = "supplement_ramp"
    DETECT_CONFLICT = "detect_conflict"
    PLANNER_CONFIRM = "planner_confirm"
    PLANNER_REJECT = "planner_reject"
    MARK_DETOUR_UNSYNCED = "mark_detour_unsynced"
    RESIDENT_APPROVE = "resident_approve"
    RESIDENT_REJECT = "resident_reject"
    UPDATE_POINT_LIST = "update_point_list"
    RECALCULATE = "recalculate"
    EXPORT = "export"
    SELF_CHECK = "self_check"


class AuditLog(BaseModel):
    operation_type: OperationType
    operator: str
    operator_role: str
    target_entity_type: str
    target_entity_id: str
    changes: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    reason: Optional[str] = None
    impacted_results: list[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.now)
