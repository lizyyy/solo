from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class SampleState(Enum):
    COLLECTED = "collected"
    SEALED = "sealed"
    HANDED_OVER = "handed_over"
    STORED = "stored"
    SHIPPED = "shipped"
    RECEIVED_LAB = "received_lab"


@dataclass
class SampleEvent:
    event_id: str
    timestamp: datetime
    event_type: str
    athlete_id: str
    sample_id: str
    details: dict[str, Any]

    @property
    def state(self) -> SampleState:
        type_to_state = {
            'collection': SampleState.COLLECTED,
            'sealing': SampleState.SEALED,
            'handover': SampleState.HANDED_OVER,
            'storage': SampleState.STORED,
            'shipping': SampleState.SHIPPED,
            'lab_receipt': SampleState.RECEIVED_LAB,
        }
        return type_to_state.get(self.event_type, SampleState.COLLECTED)


@dataclass
class SampleChain:
    athlete_id: str
    sample_id: str
    events: list[SampleEvent] = field(default_factory=list)

    @property
    def seal_a(self) -> Optional[str]:
        for e in self.events:
            if e.event_type == 'sealing' and e.details.get('bottle') == 'A':
                return e.details.get('seal_number')
        return None

    @property
    def seal_b(self) -> Optional[str]:
        for e in self.events:
            if e.event_type == 'sealing' and e.details.get('bottle') == 'B':
                return e.details.get('seal_number')
        return None

    def sorted_events(self) -> list[SampleEvent]:
        return sorted(self.events, key=lambda e: e.timestamp)


@dataclass
class ChainBuilder:
    def __init__(self):
        self.chains: dict[str, SampleChain] = {}

    def add_event(self, event_data: dict[str, Any], timestamp: datetime) -> None:
        athlete_id = event_data['athlete_id']
        sample_id = event_data['sample_id']
        event_id = event_data.get('event_id', f"{sample_id}_{len(self.chains.get(sample_id, SampleChain(athlete_id, sample_id)).events)}")

        event = SampleEvent(
            event_id=event_id,
            timestamp=timestamp,
            event_type=event_data['event_type'],
            athlete_id=athlete_id,
            sample_id=sample_id,
            details=event_data.get('details', {})
        )

        key = f"{athlete_id}_{sample_id}"
        if key not in self.chains:
            self.chains[key] = SampleChain(athlete_id=athlete_id, sample_id=sample_id)
        self.chains[key].events.append(event)

    def build_all(self) -> list[SampleChain]:
        return list(self.chains.values())

    def get_chains_by_athlete(self, athlete_id: str) -> list[SampleChain]:
        return [c for c in self.chains.values() if c.athlete_id == athlete_id]
