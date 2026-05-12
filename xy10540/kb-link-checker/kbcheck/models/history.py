from dataclasses import dataclass
from typing import Optional, Any
from datetime import datetime


@dataclass
class HistoryRecord:
    history_id: str
    command: str
    action: str
    entity_type: str
    entity_id: str
    old_value: Optional[Any]
    new_value: Optional[Any]
    status: str
    message: Optional[str]
    triggered_by: str
    recorded_at: datetime

    @classmethod
    def from_dict(cls, data: dict) -> "HistoryRecord":
        return cls(
            history_id=data["history_id"],
            command=data["command"],
            action=data["action"],
            entity_type=data["entity_type"],
            entity_id=data["entity_id"],
            old_value=data.get("old_value"),
            new_value=data.get("new_value"),
            status=data["status"],
            message=data.get("message"),
            triggered_by=data.get("triggered_by", "system"),
            recorded_at=datetime.fromisoformat(data["recorded_at"]),
        )

    def to_dict(self) -> dict:
        return {
            "history_id": self.history_id,
            "command": self.command,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "status": self.status,
            "message": self.message,
            "triggered_by": self.triggered_by,
            "recorded_at": self.recorded_at.isoformat(),
        }
