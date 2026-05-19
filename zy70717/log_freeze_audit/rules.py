from datetime import datetime
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from .models import (
    AuditRecord,
    AuditResult,
    ValidationError,
    TimeRangeOverlap,
    OperationType,
    ReleaseStatus,
)


class RuleEngine:
    def __init__(self):
        self.result = AuditResult()

    def process_records(self, records: List[AuditRecord]) -> AuditResult:
        self.result = AuditResult()

        sorted_records = sorted(
            records,
            key=lambda r: (r.log_topic, r.start_time, r.end_time, r.id)
        )

        self._check_idempotency(sorted_records)

        valid_records = [
            r for r in sorted_records
            if r.id not in {d["record_id"] for d in self.result.duplicates}
        ]

        self._check_time_range_overlaps(valid_records)
        self._merge_time_ranges(valid_records)
        self._check_release_approvals(valid_records)

        for record in valid_records:
            if record.id not in self.result.valid_records:
                self.result.valid_records[record.id] = record

        return self.result

    def _check_idempotency(self, records: List[AuditRecord]) -> None:
        idempotency_map: Dict[str, List[AuditRecord]] = defaultdict(list)

        for record in records:
            key = record.get_idempotency_key()
            idempotency_map[key].append(record)

        for key, record_list in idempotency_map.items():
            if len(record_list) > 1:
                sorted_duplicates = sorted(record_list, key=lambda r: r.id)
                primary = sorted_duplicates[0]
                for duplicate in sorted_duplicates[1:]:
                    self.result.duplicates.append(
                        {
                            "record_id": duplicate.id,
                            "primary_id": primary.id,
                            "idempotency_key": key,
                            "source_info": duplicate.source_info.dict() if duplicate.source_info else None,
                        }
                    )

    def _check_time_range_overlaps(self, records: List[AuditRecord]) -> None:
        freeze_records = [r for r in records if r.operation_type == OperationType.FREEZE]

        topic_groups: Dict[str, List[AuditRecord]] = defaultdict(list)
        for record in freeze_records:
            topic_groups[record.log_topic].append(record)

        for topic, group in topic_groups.items():
            sorted_group = sorted(group, key=lambda r: (r.start_time, r.id))
            for i in range(len(sorted_group)):
                for j in range(i + 1, len(sorted_group)):
                    r1 = sorted_group[i]
                    r2 = sorted_group[j]

                    overlap = self._calculate_overlap(r1, r2)
                    if overlap:
                        overlap_start, overlap_end = overlap
                        self.result.overlaps.append(
                            TimeRangeOverlap(
                                record1_id=r1.id,
                                record2_id=r2.id,
                                overlap_start=overlap_start,
                                overlap_end=overlap_end,
                            )
                        )

    def _calculate_overlap(
        self, r1: AuditRecord, r2: AuditRecord
    ) -> Optional[Tuple[datetime, datetime]]:
        latest_start = max(r1.start_time, r2.start_time)
        earliest_end = min(r1.end_time, r2.end_time)

        if latest_start < earliest_end:
            return (latest_start, earliest_end)
        return None

    def _merge_time_ranges(self, records: List[AuditRecord]) -> None:
        freeze_records = [r for r in records if r.operation_type == OperationType.FREEZE]

        topic_groups: Dict[str, List[AuditRecord]] = defaultdict(list)
        for record in freeze_records:
            topic_groups[record.log_topic].append(record)

        for topic, group in topic_groups.items():
            if not group:
                continue

            sorted_ranges = sorted(group, key=lambda r: (r.start_time, r.id))
            merged = []
            current_range = {
                "start_time": sorted_ranges[0].start_time,
                "end_time": sorted_ranges[0].end_time,
                "record_ids": [sorted_ranges[0].id],
                "reasons": {sorted_ranges[0].freeze_reason.value},
            }

            for record in sorted_ranges[1:]:
                if record.start_time <= current_range["end_time"]:
                    current_range["end_time"] = max(current_range["end_time"], record.end_time)
                    current_range["record_ids"].append(record.id)
                    current_range["reasons"].add(record.freeze_reason.value)
                    current_range["record_ids"] = sorted(set(current_range["record_ids"]))
                else:
                    merged.append(current_range)
                    current_range = {
                        "start_time": record.start_time,
                        "end_time": record.end_time,
                        "record_ids": [record.id],
                        "reasons": {record.freeze_reason.value},
                    }

            merged.append(current_range)
            self.result.merged_ranges[topic] = [
                {
                    "start_time": r["start_time"].isoformat(),
                    "end_time": r["end_time"].isoformat(),
                    "record_ids": r["record_ids"],
                    "reasons": sorted(list(r["reasons"])),
                }
                for r in merged
            ]

    def _check_release_approvals(self, records: List[AuditRecord]) -> None:
        release_records = [r for r in records if r.operation_type == OperationType.RELEASE]

        for record in release_records:
            if record.release_status != ReleaseStatus.APPROVED:
                self.result.pending_releases.append(
                    {
                        "record_id": record.id,
                        "log_topic": record.log_topic,
                        "current_status": record.release_status.value if record.release_status else "unknown",
                        "release_condition": record.release_condition,
                        "applicant": record.applicant,
                        "approver": record.approver,
                        "source_info": record.source_info.dict() if record.source_info else None,
                    }
                )
