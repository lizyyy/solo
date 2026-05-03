from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from .base import BaseModel


class EventType(Enum):
    HEARING = "hearing"
    EVIDENCE_SUBMISSION = "evidence_submission"
    CROSS_EXAMINATION = "cross_examination"
    JUDGMENT = "judgment"
    OTHER = "other"


@dataclass
class TimelineEvent(BaseModel):
    event_id: str
    event_date: datetime
    event_type: EventType
    description: str
    evidence_numbers: List[str] = field(default_factory=list)
    source_file: Optional[str] = None
    line_number: Optional[int] = None
    participants: List[str] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "event_id": self.event_id,
            "event_date": self.event_date.isoformat(),
            "event_type": self.event_type.value,
            "description": self.description,
            "evidence_numbers": self.evidence_numbers,
            "source_file": self.source_file,
            "line_number": self.line_number,
            "participants": self.participants,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "TimelineEvent":
        event_type = (
            EventType(data["event_type"])
            if isinstance(data["event_type"], str)
            else data["event_type"]
        )
        event_date = datetime.fromisoformat(data["event_date"])
        return cls(
            event_id=data["event_id"],
            event_date=event_date,
            event_type=event_type,
            description=data["description"],
            evidence_numbers=data.get("evidence_numbers", []),
            source_file=data.get("source_file"),
            line_number=data.get("line_number"),
            participants=data.get("participants", []),
            metadata=data.get("metadata", {}),
        )


@dataclass
class Timeline(BaseModel):
    events: Dict[str, TimelineEvent] = field(default_factory=dict)
    case_number: Optional[str] = None
    case_name: Optional[str] = None

    def add_event(self, event: TimelineEvent) -> None:
        self.events[event.event_id] = event

    def get_events_by_date(self) -> List[TimelineEvent]:
        return sorted(self.events.values(), key=lambda e: e.event_date)

    def get_events_by_evidence(self, evidence_number: str) -> List[TimelineEvent]:
        return [
            e for e in self.events.values() if evidence_number in e.evidence_numbers
        ]

    def to_dict(self) -> Dict:
        return {
            "case_number": self.case_number,
            "case_name": self.case_name,
            "events": {k: v.to_dict() for k, v in self.events.items()},
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "Timeline":
        events = {}
        for k, v in data.get("events", {}).items():
            events[k] = TimelineEvent.from_dict(v)
        return cls(
            case_number=data.get("case_number"),
            case_name=data.get("case_name"),
            events=events,
        )
