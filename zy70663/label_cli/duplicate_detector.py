from typing import List, Dict, Set, Tuple
from collections import defaultdict
from dataclasses import dataclass
from .data_reader import LabelRecord


@dataclass
class Conflict:
    conflict_type: str
    old_label: str
    conflicting_with: str
    message: str


class DuplicateDetector:
    def __init__(self):
        self.old_label_seen: Set[str] = set()
        self.new_label_seen: Set[str] = set()
        self.sku_location_seen: Dict[str, List[str]] = defaultdict(list)
        self.conflicts: List[Conflict] = []

    def detect_duplicates(self, records: List[LabelRecord]) -> Tuple[List[LabelRecord], List[Conflict]]:
        self.conflicts = []
        self.old_label_seen.clear()
        self.new_label_seen.clear()
        self.sku_location_seen.clear()

        for idx, record in enumerate(records):
            if not record.is_valid:
                continue

            self._check_duplicate_old_label(record, idx)
            self._check_duplicate_new_label(record, idx)
            self._check_sku_location_conflict(record, idx)

        return records, self.conflicts

    def _check_duplicate_old_label(self, record: LabelRecord, idx: int):
        if record.old_label in self.old_label_seen:
            conflict = Conflict(
                conflict_type="duplicate_old_label",
                old_label=record.old_label,
                conflicting_with=f"第{idx + 2}行",
                message=f"旧标签重复: {record.old_label} 在多行出现"
            )
            self.conflicts.append(conflict)
            record.is_valid = False
            record.error_messages.append(conflict.message)
        else:
            self.old_label_seen.add(record.old_label)

    def _check_duplicate_new_label(self, record: LabelRecord, idx: int):
        if record.new_label and record.new_label in self.new_label_seen:
            conflict = Conflict(
                conflict_type="duplicate_new_label",
                old_label=record.old_label,
                conflicting_with=f"第{idx + 2}行",
                message=f"新标签冲突: {record.new_label} 已被其他旧标签映射"
            )
            self.conflicts.append(conflict)
            record.is_valid = False
            record.error_messages.append(conflict.message)
        elif record.new_label:
            self.new_label_seen.add(record.new_label)

    def _check_sku_location_conflict(self, record: LabelRecord, idx: int):
        key = f"{record.sku}-{record.location}"

        if key in self.sku_location_seen:
            if record.old_label not in self.sku_location_seen[key]:
                conflict = Conflict(
                    conflict_type="sku_location_conflict",
                    old_label=record.old_label,
                    conflicting_with=f"旧标签: {self.sku_location_seen[key][0]}",
                    message=f"SKU+库位冲突: {record.sku}@{record.location} 已被其他标签使用"
                )
                self.conflicts.append(conflict)
                record.is_valid = False
                record.error_messages.append(conflict.message)
        else:
            self.sku_location_seen[key].append(record.old_label)

    def get_conflict_summary(self) -> Dict[str, int]:
        summary: Dict[str, int] = defaultdict(int)
        for conflict in self.conflicts:
            summary[conflict.conflict_type] += 1
        return dict(summary)

    def has_conflicts(self) -> bool:
        return len(self.conflicts) > 0
