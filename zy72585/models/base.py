import hashlib
import json
from datetime import datetime
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from copy import deepcopy


@dataclass
class FieldDiff:
    field_name: str
    old_value: Any
    new_value: Any
    changed_at: datetime = field(default_factory=datetime.now)
    changed_by: str = "system"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "changed_at": self.changed_at.isoformat(),
            "changed_by": self.changed_by,
        }


@dataclass
class AuditLog:
    operation: str
    operator: str
    timestamp: datetime = field(default_factory=datetime.now)
    reason: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    affected_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operation": self.operation,
            "operator": self.operator,
            "timestamp": self.timestamp.isoformat(),
            "reason": self.reason,
            "details": self.details,
            "affected_ids": self.affected_ids,
        }


class VersionedModel:
    def __init__(self):
        self.id: str = ""
        self.version: int = 1
        self.created_at: datetime = datetime.now()
        self.updated_at: datetime = datetime.now()
        self.created_by: str = "system"
        self.updated_by: str = "system"
        self._history: List[Dict[str, Any]] = []
        self._audit_logs: List[AuditLog] = []
        self._content_hash: str = ""

    def _compute_hash(self, data: Dict[str, Any]) -> str:
        filtered = {k: v for k, v in data.items() if not k.startswith('_')}
        return hashlib.sha256(
            json.dumps(filtered, sort_keys=True, default=str).encode()
        ).hexdigest()

    def _snapshot(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "snapshot_at": datetime.now().isoformat(),
            "data": deepcopy(self._get_public_state()),
        }

    def _get_public_state(self) -> Dict[str, Any]:
        return {
            k: v for k, v in self.__dict__.items()
            if not k.startswith('_')
        }

    def update(self, updates: Dict[str, Any], operator: str, reason: str = "") -> List[FieldDiff]:
        old_state = self._get_public_state()
        diffs = []

        for key, new_val in updates.items():
            if key in old_state and old_state[key] != new_val:
                diffs.append(FieldDiff(
                    field_name=key,
                    old_value=old_state[key],
                    new_value=new_val,
                    changed_by=operator,
                ))
                setattr(self, key, new_val)

        if diffs:
            self._history.append(self._snapshot())
            self.version += 1
            self.updated_at = datetime.now()
            self.updated_by = operator
            self._content_hash = self._compute_hash(self._get_public_state())
            self._audit_logs.append(AuditLog(
                operation="update",
                operator=operator,
                reason=reason,
                details={"diffs": [d.to_dict() for d in diffs]},
                affected_ids=[self.id],
            ))

        return diffs

    def get_history(self) -> List[Dict[str, Any]]:
        return self._history.copy()

    def get_audit_logs(self) -> List[AuditLog]:
        return self._audit_logs.copy()

    def get_field_history(self, field_name: str) -> List[Dict[str, Any]]:
        history = []
        for snapshot in self._history:
            if field_name in snapshot["data"]:
                history.append({
                    "version": snapshot["version"],
                    "timestamp": snapshot["snapshot_at"],
                    "value": snapshot["data"][field_name],
                })
        return history

    def get_content_hash(self) -> str:
        if not self._content_hash:
            self._content_hash = self._compute_hash(self._get_public_state())
        return self._content_hash

    def to_dict(self) -> Dict[str, Any]:
        return {
            **self._get_public_state(),
            "content_hash": self.get_content_hash(),
            "history_count": len(self._history),
            "audit_count": len(self._audit_logs),
        }
