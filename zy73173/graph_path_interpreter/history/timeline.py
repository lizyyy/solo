from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import List, Dict, Any, Optional


class EventType(Enum):
    DATA_IMPORT = "data_import"
    PARAM_VERSION_CHANGE = "param_version_change"
    RECALL_ADD = "recall_add"
    NOTE_ADD = "note_add"
    CALCULATION_RUN = "calculation_run"
    RESULT_EXPORT = "result_export"
    SERVICE_RESTART = "service_restart"


@dataclass
class TimelineEvent:
    event_id: str
    event_type: EventType
    description: str
    timestamp: datetime = field(default_factory=datetime.now)
    details: Dict[str, Any] = field(default_factory=dict)
    related_note_ids: List[str] = field(default_factory=list)
    operator: str = "system"

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "description": self.description,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
            "related_note_ids": self.related_note_ids,
            "operator": self.operator,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "TimelineEvent":
        return cls(
            event_id=data["event_id"],
            event_type=EventType(data["event_type"]),
            description=data["description"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            details=data.get("details", {}),
            related_note_ids=data.get("related_note_ids", []),
            operator=data.get("operator", "system"),
        )


class HistoryTimeline:
    def __init__(self):
        self.events: List[TimelineEvent] = []
        self._event_counter = 0

    def add_event(
        self,
        event_type: EventType,
        description: str,
        details: Optional[Dict[str, Any]] = None,
        related_note_ids: Optional[List[str]] = None,
        operator: str = "system",
    ) -> TimelineEvent:
        self._event_counter += 1
        event = TimelineEvent(
            event_id=f"evt_{self._event_counter}_{int(datetime.now().timestamp())}",
            event_type=event_type,
            description=description,
            details=details or {},
            related_note_ids=related_note_ids or [],
            operator=operator,
        )
        self.events.append(event)
        self.events.sort(key=lambda e: e.timestamp)
        return event

    def get_events_by_type(self, event_type: EventType) -> List[TimelineEvent]:
        return [e for e in self.events if e.event_type == event_type]

    def search_by_note_keyword(self, keyword: str) -> List[TimelineEvent]:
        results = []
        for event in self.events:
            if keyword.lower() in event.description.lower():
                results.append(event)
                continue
            for note_id in event.related_note_ids:
                if keyword.lower() in note_id.lower():
                    results.append(event)
                    break
            details_str = str(event.details).lower()
            if keyword.lower() in details_str:
                results.append(event)
        return results

    def get_events_in_timerange(
        self, start: datetime, end: datetime
    ) -> List[TimelineEvent]:
        return [e for e in self.events if start <= e.timestamp <= end]

    def get_latest_conclusion(self) -> Optional[TimelineEvent]:
        calc_events = [
            e for e in self.events
            if e.event_type == EventType.CALCULATION_RUN
        ]
        if calc_events:
            return calc_events[-1]
        return None

    def get_timeline_summary(self) -> Dict[str, Any]:
        type_counts: Dict[str, int] = {}
        for event in self.events:
            type_name = event.event_type.value
            type_counts[type_name] = type_counts.get(type_name, 0) + 1

        return {
            "total_events": len(self.events),
            "event_type_counts": type_counts,
            "first_event": self.events[0].timestamp.isoformat() if self.events else None,
            "last_event": self.events[-1].timestamp.isoformat() if self.events else None,
        }

    def to_dict(self) -> dict:
        return {"events": [e.to_dict() for e in self.events]}

    @classmethod
    def from_dict(cls, data: dict) -> "HistoryTimeline":
        timeline = cls()
        for e_data in data.get("events", []):
            timeline.events.append(TimelineEvent.from_dict(e_data))
        if timeline.events:
            max_counter = 0
            for e in timeline.events:
                parts = e.event_id.split("_")
                if len(parts) >= 2 and parts[1].isdigit():
                    max_counter = max(max_counter, int(parts[1]))
            timeline._event_counter = max_counter
        return timeline
