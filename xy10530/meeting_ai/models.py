from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import List, Optional


class ActionItemStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    DONE = "done"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class OperationType(Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    IMPORT = "import"
    CHECK = "check"
    COMPLETE = "complete"
    CANCEL = "cancel"


@dataclass
class Participant:
    id: Optional[int]
    name: str
    email: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Role:
    id: Optional[int]
    name: str
    description: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ParticipantRole:
    participant_id: int
    role_id: int


@dataclass
class Meeting:
    id: Optional[int]
    title: str
    meeting_date: date
    attendees: str
    content_hash: str
    source_path: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ActionItem:
    id: Optional[int]
    meeting_id: int
    description: str
    assignees: List[str]
    due_date: Optional[date]
    status: ActionItemStatus
    dependencies: List[int] = field(default_factory=list)
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


@dataclass
class AuditLog:
    id: Optional[int]
    entity_type: str
    entity_id: int
    operation_type: OperationType
    operator: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ImportRecord:
    id: Optional[int]
    content_hash: str
    source_path: str
    imported_at: datetime = field(default_factory=datetime.now)
