from typing import List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime

from .models import TimelineEvent, TimelineEventType, EventSeverity


class TimelineTracker:
    def __init__(self):
        self._events: List[TimelineEvent] = []
        self._order_counter = 0

    def add_event(
        self,
        event_type: str,
        time: float,
        measure: int,
        description: str,
        severity: EventSeverity = EventSeverity.INFO,
        details: Dict[str, Any] = None,
    ) -> TimelineEvent:
        event = TimelineEvent(
            event_type=TimelineEventType(event_type),
            time=time,
            measure=measure,
            description=description,
            severity=severity,
            details=details or {},
            order=self._order_counter,
        )
        self._events.append(event)
        self._order_counter += 1
        return event

    def get_sorted_events(self) -> List[TimelineEvent]:
        return sorted(self._events, key=lambda e: (e.time, e.order))

    def get_events_by_type(self, event_type: TimelineEventType) -> List[TimelineEvent]:
        return [e for e in self._events if e.event_type == event_type]

    def get_events_by_measure(self, measure: int) -> List[TimelineEvent]:
        return [e for e in self._events if e.measure == measure]

    def get_events_by_severity(self, severity: EventSeverity) -> List[TimelineEvent]:
        return [e for e in self._events if e.severity == severity]

    def get_event_chain(self, start_time: float, end_time: float) -> List[TimelineEvent]:
        return [
            e
            for e in self.get_sorted_events()
            if start_time <= e.time <= end_time
        ]

    def find_related_events(
        self, target_event: TimelineEvent, time_window_sec: float = 2.0
    ) -> List[TimelineEvent]:
        return [
            e
            for e in self._events
            if e.order != target_event.order
            and abs(e.time - target_event.time) <= time_window_sec
        ]

    def generate_timeline_analysis(self) -> List[str]:
        sorted_events = self.get_sorted_events()
        analyses = []

        for i, event in enumerate(sorted_events):
            context = []
            if i > 0:
                prev = sorted_events[i - 1]
                time_gap = event.time - prev.time
                if time_gap < 0.5:
                    context.append(
                        f"紧接在「{prev.description}」之后 {time_gap*1000:.0f}ms"
                    )

            related = self.find_related_events(event, time_window_sec=1.0)
            bpm_changes = [
                e for e in related if e.event_type == TimelineEventType.BPM_CHANGE
            ]
            noise_events = [
                e
                for e in related
                if e.event_type == TimelineEventType.NOISE_FALSE_POSITIVE
            ]
            weak_misses = [
                e
                for e in related
                if e.event_type == TimelineEventType.WEAK_BEAT_MISS
            ]

            if (
                event.event_type == TimelineEventType.WEAK_BEAT_MISS
                and bpm_changes
            ):
                context.append(
                    f"与 BPM 变化同时发生（从 {bpm_changes[0].details.get('original_bpm', '?'):.1f} 变为 {bpm_changes[0].details.get('window_bpm', '?'):.1f}）"
                )

            if (
                event.event_type == TimelineEventType.NOISE_FALSE_POSITIVE
                and weak_misses
            ):
                context.append(
                    f"可能是对第 {weak_misses[0].details.get('beat_type', '弱拍')} 漏检的补偿性检测"
                )

            if (
                event.event_type == TimelineEventType.SIGNIFICANT_DEVIATION
                and bpm_changes
            ):
                context.append(
                    f"发生在 BPM 不稳定期间，可能与速度变化有关"
                )

            if context:
                analyses.append(
                    f"[{event.time:.2f}s] 第 {event.measure} 小节 - {event.description}（{'；'.join(context)}）"
                )
            else:
                analyses.append(
                    f"[{event.time:.2f}s] 第 {event.measure} 小节 - {event.description}"
                )

        return analyses

    def __len__(self) -> int:
        return len(self._events)

    def __iter__(self):
        return iter(self.get_sorted_events())
