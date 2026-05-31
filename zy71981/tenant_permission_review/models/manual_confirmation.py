from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from uuid import uuid4


@dataclass
class ManualConfirmation:
    related_record_id: str
    record_type: str
    operator_id: str
    operator_name: str
    action: str
    reason: str
    confirmation_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    before_state: Optional[dict] = None
    after_state: Optional[dict] = None
    comments: Optional[str] = None

    def to_dict(self):
        return {
            "confirmation_id": self.confirmation_id,
            "related_record_id": self.related_record_id,
            "record_type": self.record_type,
            "operator_id": self.operator_id,
            "operator_name": self.operator_name,
            "action": self.action,
            "reason": self.reason,
            "timestamp": self.timestamp.isoformat(),
            "before_state": self.before_state,
            "after_state": self.after_state,
            "comments": self.comments,
        }
