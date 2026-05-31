from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict
from uuid import uuid4
from .base import RecordStatus


@dataclass
class PermissionChange:
    tenant_id: str
    user_id: str
    permission_code: str
    change_type: str
    source_log_id: str
    change_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    old_value: Optional[bool] = None
    new_value: Optional[bool] = None
    status: RecordStatus = RecordStatus.PENDING
    metadata: Dict = field(default_factory=dict)
    failure_reason: Optional[str] = None

    def to_dict(self):
        return {
            "change_id": self.change_id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "permission_code": self.permission_code,
            "change_type": self.change_type,
            "source_log_id": self.source_log_id,
            "timestamp": self.timestamp.isoformat(),
            "old_value": self.old_value,
            "new_value": self.new_value,
            "status": self.status.value,
            "metadata": self.metadata,
            "failure_reason": self.failure_reason,
        }
