from typing import Dict, List, Tuple, Any
from collections import defaultdict
from .models import WebhookEvent, DualDeliveryResult, BadLine, ParseResult


class SourceTracker:
    def __init__(self):
        self.event_sources: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.bad_lines: List[BadLine] = []

    def track_parse_result(self, parse_result: ParseResult):
        self.bad_lines.extend(parse_result.bad_lines)
        for event in parse_result.valid_events:
            self.track_event(event)

    def track_event(self, event: WebhookEvent):
        source_info = {
            "source_file": event.source_file,
            "line_number": event.line_number,
            "timestamp": event.timestamp,
            "endpoint": event.endpoint,
            "status_code": event.status_code,
        }
        self.event_sources[event.event_id].append(source_info)

    def get_event_sources(self, event_id: str) -> List[Dict[str, Any]]:
        return sorted(self.event_sources.get(event_id, []), key=lambda x: (x["source_file"], x["line_number"]))

    def get_all_event_ids(self) -> List[str]:
        return sorted(self.event_sources.keys())

    def get_bad_lines(self) -> List[BadLine]:
        return sorted(self.bad_lines, key=lambda x: (x.source_file, x.line_number))


class ResultStabilizer:
    @staticmethod
    def stabilize_dual_delivery_results(results: List[DualDeliveryResult]) -> List[DualDeliveryResult]:
        return sorted(
            results,
            key=lambda x: (
                x.vendor,
                x.event_type,
                x.old_timestamp or x.new_timestamp,
                x.event_id,
            )
        )

    @staticmethod
    def stabilize_event_list(events: List[WebhookEvent]) -> List[WebhookEvent]:
        return sorted(
            events,
            key=lambda x: (
                x.vendor,
                x.event_type,
                x.timestamp,
                x.event_id,
                x.source_file,
                x.line_number,
            )
        )

    @staticmethod
    def group_by_vendor_event_type(
        results: List[DualDeliveryResult],
    ) -> Dict[Tuple[str, str], List[DualDeliveryResult]]:
        grouped: Dict[Tuple[str, str], List[DualDeliveryResult]] = defaultdict(list)
        for result in results:
            grouped[(result.vendor, result.event_type)].append(result)
        for key in grouped:
            grouped[key] = ResultStabilizer.stabilize_dual_delivery_results(grouped[key])
        return dict(sorted(grouped.items()))

    @staticmethod
    def get_unique_vendors_event_types(results: List[DualDeliveryResult]) -> List[Tuple[str, str]]:
        unique = set((r.vendor, r.event_type) for r in results)
        return sorted(unique)
