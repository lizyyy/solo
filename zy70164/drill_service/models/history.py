from dataclasses import dataclass
from enum import Enum
from typing import Optional
from drill_service.models.base import BaseModel


class OperationType(str, Enum):
    CREATE_PLAN = "create_plan"
    UPDATE_PLAN = "update_plan"
    START_DRILL = "start_drill"
    SWITCH_TRAFFIC = "switch_traffic"
    READONLY_CHECK = "readonly_check"
    SWITCH_COMPLETE = "switch_complete"
    ROLLBACK_REQUEST = "rollback_request"
    ROLLBACK_EXECUTE = "rollback_execute"
    ROLLBACK_CONFIRM = "rollback_confirm"
    COMPLETE_DRILL = "complete_drill"
    SUPPLEMENT = "supplement"
    CANCEL_DRILL = "cancel_drill"
    WITHDRAW = "withdraw"


@dataclass
class OperationHistory(BaseModel):
    history_id: str
    plan_id: str
    operation_type: OperationType
    operator: str
    timestamp: str
    details: str
    is_withdrawn: bool = False
    withdrawn_by: Optional[str] = None
    withdrawn_at: Optional[str] = None
    
    @classmethod
    def from_dict(cls, data: dict):
        data = data.copy()
        if isinstance(data["operation_type"], str):
            data["operation_type"] = OperationType(data["operation_type"])
        return cls(**data)
    
    def to_dict(self):
        result = super().to_dict()
        result["operation_type"] = self.operation_type.value
        return result
