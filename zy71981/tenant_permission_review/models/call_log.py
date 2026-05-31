from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from uuid import uuid4


@dataclass
class CallLog:
    tenant_id: str
    user_id: str
    action: str
    request_body: dict
    idempotency_key: Optional[str] = None
    log_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    response_status: Optional[int] = None
    response_body: Optional[dict] = None
    source_system: str = "api"

    def generate_idempotency_key(self) -> str:
        if not self.idempotency_key:
            self.idempotency_key = f"{self.tenant_id}:{self.user_id}:{self.action}:{hash(frozenset(self.request_body.items()))}"
        return self.idempotency_key

    def to_dict(self):
        return {
            "log_id": self.log_id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "action": self.action,
            "request_body": self.request_body,
            "idempotency_key": self.idempotency_key,
            "timestamp": self.timestamp.isoformat(),
            "response_status": self.response_status,
            "response_body": self.response_body,
            "source_system": self.source_system,
        }
