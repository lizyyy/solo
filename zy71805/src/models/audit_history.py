from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Any
import uuid


@dataclass
class AuditRecord:
    audit_id: str
    record_type: str
    record_id: str
    action: str
    field_name: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    changed_by: str = "system"
    changed_at: datetime = field(default_factory=datetime.now)
    reason: Optional[str] = None
    source: Optional[str] = None

    @classmethod
    def create(
        cls,
        record_type: str,
        record_id: str,
        action: str,
        field_name: Optional[str] = None,
        old_value: Optional[Any] = None,
        new_value: Optional[Any] = None,
        changed_by: str = "system",
        reason: Optional[str] = None,
        source: Optional[str] = None
    ) -> "AuditRecord":
        return cls(
            audit_id=str(uuid.uuid4()),
            record_type=record_type,
            record_id=record_id,
            action=action,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            changed_at=datetime.now(),
            reason=reason,
            source=source
        )

    def to_dict(self) -> dict:
        return {
            "audit_id": self.audit_id,
            "record_type": self.record_type,
            "record_id": self.record_id,
            "action": self.action,
            "field_name": self.field_name,
            "old_value": str(self.old_value) if self.old_value is not None else None,
            "new_value": str(self.new_value) if self.new_value is not None else None,
            "changed_by": self.changed_by,
            "changed_at": self.changed_at.isoformat(),
            "reason": self.reason,
            "source": self.source
        }
