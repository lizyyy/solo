from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

from dateutil.parser import parse as parse_date

from ..models import Timeline as TimelineModel, TimelineEvent as TimelineEventModel, EventType, Reference, EvidenceCatalog


@dataclass
class TimelineEvent:
    event_id: str
    event_date: datetime
    event_type: EventType
    description: str
    evidence_numbers: List[str] = field(default_factory=list)
    source_file: Optional[str] = None
    line_number: Optional[int] = None
    participants: List[str] = field(default_factory=list)
    raw_data: Dict = field(default_factory=dict)


class TimelineAnalyzer:
    CHINESE_MONTHS = {
        "一月": 1, "二月": 2, "三月": 3, "四月": 4, "五月": 5, "六月": 6,
        "七月": 7, "八月": 8, "九月": 9, "十月": 10, "十一月": 11, "十二月": 12,
    }

    def __init__(self):
        self.events: List[TimelineEvent] = []
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def build_from_references(
        self,
        references: List[Reference],
        evidence_catalog: Optional[EvidenceCatalog] = None,
    ) -> List[TimelineEvent]:
        self.events = []
        event_id_counter = 0

        for ref in references:
            dates = self._extract_dates_from_reference(ref)

            for dt in dates:
                event_id_counter += 1
                event = TimelineEvent(
                    event_id=f"event_{event_id_counter:04d}",
                    event_date=dt,
                    event_type=self._determine_event_type(ref),
                    description=f"引用证据 [{ref.evidence_number}]: {ref.source_context}",
                    evidence_numbers=[ref.evidence_number],
                    source_file=ref.source_file,
                    line_number=ref.line_number,
                    raw_data=ref.to_dict(),
                )
                self.events.append(event)

        self.events.sort(key=lambda e: e.event_date)
        return self.events

    def _extract_dates_from_reference(self, ref: Reference) -> List[datetime]:
        dates = []

        if ref.reference_date:
            dates.append(ref.reference_date)

        if ref.description:
            extracted = self._parse_dates_from_text(ref.description)
            dates.extend(extracted)

        if ref.source_context:
            extracted = self._parse_dates_from_text(ref.source_context)
            dates.extend(extracted)

        unique_dates = []
        seen = set()
        for dt in dates:
            date_key = (dt.year, dt.month, dt.day, dt.hour, dt.minute)
            if date_key not in seen:
                seen.add(date_key)
                unique_dates.append(dt)

        return unique_dates

    def _parse_dates_from_text(self, text: str) -> List[datetime]:
        dates = []

        import re

        patterns = [
            r"(\d{4})年(\d{1,2})月(\d{1,2})日",
            r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})",
            r"(\d{1,2})月(\d{1,2})日",
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                try:
                    if len(match) == 3 and match[0]:
                        year = int(match[0])
                        month = int(match[1])
                        day = int(match[2])
                        dt = datetime(year, month, day)
                        dates.append(dt)
                    elif len(match) == 2:
                        month = int(match[0])
                        day = int(match[1])
                        from datetime import datetime as dt_type
                        current_year = dt_type.now().year
                        dt = datetime(current_year, month, day)
                        dates.append(dt)
                except Exception:
                    pass

        try:
            parsed = parse_date(text, fuzzy=True)
            if parsed and parsed.year >= 1900:
                if not any(
                    (d.year == parsed.year and d.month == parsed.month and d.day == parsed.day)
                    for d in dates
                ):
                    dates.append(parsed)
        except Exception:
            pass

        return dates

    def _determine_event_type(self, ref: Reference) -> EventType:
        from ..models import ReferenceType

        type_mapping = {
            ReferenceType.TRANSCRIPT: EventType.HEARING,
            ReferenceType.EVIDENCE_LIST: EventType.EVIDENCE_SUBMISSION,
            ReferenceType.CROSS_EXAMINATION: EventType.CROSS_EXAMINATION,
            ReferenceType.JUDGMENT_DRAFT: EventType.JUDGMENT,
        }

        return type_mapping.get(ref.reference_type, EventType.OTHER)

    def check_date_conflicts(self) -> List[Dict]:
        conflicts = []

        if len(self.events) < 2:
            return conflicts

        by_evidence: Dict[str, List[TimelineEvent]] = defaultdict(list)
        for event in self.events:
            for ev_num in event.evidence_numbers:
                by_evidence[ev_num].append(event)

        for ev_num, events in by_evidence.items():
            if len(events) < 2:
                continue

            unique_dates = set()
            for event in events:
                date_key = (event.event_date.year, event.event_date.month, event.event_date.day)
                unique_dates.add(date_key)

            if len(unique_dates) > 1:
                conflicts.append({
                    "evidence_number": ev_num,
                    "conflicting_dates": [
                        {
                            "date": e.event_date.isoformat(),
                            "source_file": e.source_file,
                            "line_number": e.line_number,
                            "description": e.description[:100] if e.description else "",
                        }
                        for e in events
                    ],
                })

        return conflicts

    def check_timeline_order(self) -> List[Dict]:
        issues = []

        for i in range(1, len(self.events)):
            prev_event = self.events[i - 1]
            curr_event = self.events[i]

            if curr_event.event_date < prev_event.event_date:
                issues.append({
                    "issue": "time_order_inconsistency",
                    "prev_event": {
                        "event_id": prev_event.event_id,
                        "date": prev_event.event_date.isoformat(),
                        "description": prev_event.description,
                        "source_file": prev_event.source_file,
                    },
                    "curr_event": {
                        "event_id": curr_event.event_id,
                        "date": curr_event.event_date.isoformat(),
                        "description": curr_event.description,
                        "source_file": curr_event.source_file,
                    },
                })

        return issues

    def get_evidence_timeline(self, evidence_number: str) -> List[TimelineEvent]:
        return [
            e for e in self.events
            if evidence_number in e.evidence_numbers
        ]

    def to_model(self) -> TimelineModel:
        timeline = TimelineModel()
        for event in self.events:
            model_event = TimelineEventModel(
                event_id=event.event_id,
                event_date=event.event_date,
                event_type=event.event_type,
                description=event.description,
                evidence_numbers=event.evidence_numbers,
                source_file=event.source_file,
                line_number=event.line_number,
                participants=event.participants,
            )
            timeline.add_event(model_event)
        return timeline


def build_timeline(
    references: List[Reference],
    evidence_catalog: Optional[EvidenceCatalog] = None,
) -> Tuple[List[TimelineEvent], TimelineAnalyzer]:
    analyzer = TimelineAnalyzer()
    events = analyzer.build_from_references(references, evidence_catalog)
    return events, analyzer
