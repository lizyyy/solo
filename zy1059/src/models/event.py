from dataclasses import dataclass, field
from datetime import datetime, date, timezone, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid


class EventStatus(Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    TENTATIVE = "tentative"


class RecurrenceType(Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


@dataclass
class RecurrenceRule:
    freq: RecurrenceType
    count: Optional[int] = None
    until: Optional[datetime] = None
    interval: int = 1
    by_day: List[str] = field(default_factory=list)
    by_month_day: List[int] = field(default_factory=list)
    by_month: List[int] = field(default_factory=list)
    by_set_pos: List[int] = field(default_factory=list)
    wkst: int = 0  # 0=Monday, 6=Sunday
    original_rule: str = ""


@dataclass
class Event:
    uid: str
    title: str
    start: datetime
    end: datetime
    source_file: str
    
    all_day: bool = False
    location: Optional[str] = None
    description: Optional[str] = None
    status: EventStatus = EventStatus.ACTIVE
    organizer: Optional[str] = None
    attendees: List[str] = field(default_factory=list)
    
    recurrence_rule: Optional[RecurrenceRule] = None
    recurrence_id: Optional[datetime] = None
    exceptions: List[datetime] = field(default_factory=list)
    
    is_expanded: bool = False
    original_start: Optional[datetime] = None
    original_end: Optional[datetime] = None
    
    merged_from: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration(self) -> timedelta:
        return self.end - self.start

    @property
    def is_recurrence(self) -> bool:
        return self.recurrence_rule is not None or self.recurrence_id is not None

    @property
    def is_cross_day(self) -> bool:
        return self.start.date() != self.end.date() and not self.all_day

    def to_dict(self) -> Dict[str, Any]:
        return {
            "uid": self.uid,
            "title": self.title,
            "start": self.start.isoformat() if self.start else None,
            "end": self.end.isoformat() if self.end else None,
            "source_file": self.source_file,
            "all_day": self.all_day,
            "location": self.location,
            "description": self.description,
            "status": self.status.value,
            "organizer": self.organizer,
            "attendees": self.attendees,
            "recurrence_rule": self.recurrence_rule.original_rule if self.recurrence_rule else None,
            "is_expanded": self.is_expanded,
            "merged_from": self.merged_from,
        }

    def generate_new_uid(self) -> str:
        self.uid = f"{uuid.uuid4()}@schedule-cleaner.local"
        return self.uid

    def clone(self) -> 'Event':
        import copy
        cloned = copy.deepcopy(self)
        cloned.generate_new_uid()
        return cloned


@dataclass
class ValidationError:
    source_file: str
    line_number: Optional[int]
    event_title: Optional[str]
    error_type: str
    message: str
    severity: str = "error"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_file": self.source_file,
            "line_number": self.line_number,
            "event_title": self.event_title,
            "error_type": self.error_type,
            "message": self.message,
            "severity": self.severity,
        }


@dataclass
class Conflict:
    conflict_type: str
    events: List[Event]
    description: str
    suggestion: str = ""
    severity: str = "warning"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_type": self.conflict_type,
            "events": [e.to_dict() for e in self.events],
            "description": self.description,
            "suggestion": self.suggestion,
            "severity": self.severity,
        }
