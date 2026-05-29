from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import uuid4


@dataclass
class BaseModel:
    id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            k: v.isoformat() if isinstance(v, datetime) else v
            for k, v in self.__dict__.items()
        }


@dataclass
class AuditLog:
    action: str
    operator: str
    timestamp: datetime = field(default_factory=datetime.now)
    details: str = ""
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action": self.action,
            "operator": self.operator,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
            "before": self.before,
            "after": self.after,
        }


@dataclass
class Attachment:
    name: str
    type: str
    path: str
    uploaded_at: datetime = field(default_factory=datetime.now)
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": self.type,
            "path": self.path,
            "uploaded_at": self.uploaded_at.isoformat(),
            "description": self.description,
        }


@dataclass
class Correction:
    field: str
    old_value: Any
    new_value: Any
    operator: str
    reason: str
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field": self.field,
            "old_value": str(self.old_value),
            "new_value": str(self.new_value),
            "operator": self.operator,
            "reason": self.reason,
            "timestamp": self.timestamp.isoformat(),
        }
