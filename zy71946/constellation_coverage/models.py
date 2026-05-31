from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import hashlib
import json


class RecordStatus(str, Enum):
    PENDING = "pending"
    NORMAL = "normal"
    LATE_ARRIVAL = "late_arrival"
    DUPLICATE = "duplicate"
    MANUAL_CORRECTED = "manual_corrected"
    TIME_CONFLICT = "time_conflict"
    RESOLVED = "resolved"
    DISCARDED = "discarded"


class SourceType(str, Enum):
    TELEMETRY = "telemetry"
    PAYLOAD_PLAN = "payload_plan"
    SCHEDULE = "schedule"
    MANUAL = "manual"


@dataclass
class Source:
    type: SourceType
    system: str
    file: str
    import_time: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "system": self.system,
            "file": self.file,
            "import_time": self.import_time.isoformat()
        }


@dataclass
class AuditLog:
    timestamp: datetime
    actor: str
    action: str
    from_status: Optional[RecordStatus] = None
    to_status: Optional[RecordStatus] = None
    reason: str = ""
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "actor": self.actor,
            "action": self.action,
            "from_status": self.from_status.value if self.from_status else None,
            "to_status": self.to_status.value if self.to_status else None,
            "reason": self.reason,
            "details": self.details
        }


@dataclass
class Record:
    id: str
    satellite: str
    start_time: datetime
    end_time: datetime
    status: RecordStatus
    source: Source
    content: Dict[str, Any]
    audit_log: List[AuditLog] = field(default_factory=list)
    pending_reason: str = ""
    duplicate_of: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        if not self.id:
            self.id = self._generate_id()

    def _generate_id(self) -> str:
        key = f"{self.satellite}|{self.start_time.isoformat()}|{self.end_time.isoformat()}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

    def content_hash(self) -> str:
        content_str = json.dumps(self.content, sort_keys=True)
        return hashlib.sha256(content_str.encode()).hexdigest()[:16]

    def add_audit_log(self, log: AuditLog):
        self.audit_log.append(log)
        self.updated_at = log.timestamp

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "satellite": self.satellite,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "status": self.status.value,
            "source": self.source.to_dict(),
            "content": self.content,
            "audit_log": [log.to_dict() for log in self.audit_log],
            "pending_reason": self.pending_reason,
            "duplicate_of": self.duplicate_of,
            "tags": self.tags,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Record":
        source_data = data["source"]
        source = Source(
            type=SourceType(source_data["type"]),
            system=source_data["system"],
            file=source_data["file"],
            import_time=datetime.fromisoformat(source_data["import_time"])
        )
        
        audit_logs = [
            AuditLog(
                timestamp=datetime.fromisoformat(log["timestamp"]),
                actor=log["actor"],
                action=log["action"],
                from_status=RecordStatus(log["from_status"]) if log.get("from_status") else None,
                to_status=RecordStatus(log["to_status"]) if log.get("to_status") else None,
                reason=log.get("reason", ""),
                details=log.get("details", {})
            )
            for log in data.get("audit_log", [])
        ]
        
        return cls(
            id=data["id"],
            satellite=data["satellite"],
            start_time=datetime.fromisoformat(data["start_time"]),
            end_time=datetime.fromisoformat(data["end_time"]),
            status=RecordStatus(data["status"]),
            source=source,
            content=data["content"],
            audit_log=audit_logs,
            pending_reason=data.get("pending_reason", ""),
            duplicate_of=data.get("duplicate_of"),
            tags=data.get("tags", []),
            created_at=datetime.fromisoformat(data.get("created_at", datetime.now().isoformat())),
            updated_at=datetime.fromisoformat(data.get("updated_at", datetime.now().isoformat()))
        )
