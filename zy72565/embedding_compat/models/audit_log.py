from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass
class AuditLogEntry:
    """审计日志条目

    每一次状态变更、每一次人工修改都留痕
    推荐负责人问"谁什么时候改了什么"，直接查这个
    """

    timestamp: datetime
    actor: str
    action: str
    record_id: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    details: Optional[str] = None
    field_changed: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "actor": self.actor,
            "action": self.action,
            "record_id": self.record_id,
            "previous_status": self.previous_status,
            "new_status": self.new_status,
            "details": self.details,
            "field_changed": self.field_changed,
            "old_value": self.old_value,
            "new_value": self.new_value,
        }
