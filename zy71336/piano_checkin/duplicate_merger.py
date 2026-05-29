"""重复合并逻辑 - 检测同日重复上传并智能合并"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from collections import defaultdict

from .models import (
    CheckinRecord, RecordStatus, AbnormalType,
    load_json, save_json, RECORDS_FILE
)


@dataclass
class DuplicateGroup:
    student_id: str
    checkin_date: str
    records: List[CheckinRecord] = field(default_factory=list)

    def add_record(self, record: CheckinRecord):
        self.records.append(record)

    @property
    def size(self) -> int:
        return len(self.records)


@dataclass
class MergeResult:
    merged: bool
    primary_record: Optional[CheckinRecord]
    merged_records: List[CheckinRecord]
    details: List[str]


class DuplicateMerger:
    MERGE_WINDOW_MINUTES = 120

    def __init__(self, merge_window_minutes: int = None):
        self.merge_window = merge_window_minutes or self.MERGE_WINDOW_MINUTES
        self._groups: List[DuplicateGroup] = []

    def find_duplicates(
        self,
        records: List[CheckinRecord]
    ) -> List[DuplicateGroup]:
        groups_dict: Dict[Tuple[str, str], DuplicateGroup] = {}

        active_records = [
            r for r in records
            if r.status != RecordStatus.MERGED
        ]

        for record in active_records:
            key = (record.student_id, record.checkin_date)
            if key not in groups_dict:
                groups_dict[key] = DuplicateGroup(
                    student_id=record.student_id,
                    checkin_date=record.checkin_date
                )
            groups_dict[key].add_record(record)

        self._groups = [
            g for g in groups_dict.values()
            if g.size > 1
        ]
        return self._groups

    def select_primary(
        self,
        group: DuplicateGroup
    ) -> Tuple[CheckinRecord, List[CheckinRecord], List[str]]:
        records = sorted(
            group.records,
            key=lambda r: r.created_at
        )

        details: List[str] = []
        scored = []

        for i, record in enumerate(records):
            score = self._score_record(record)
            scored.append((score, i, record))
            details.append(
                f"  记录{i+1}[{record.record_id[:8]}]: "
                f"提交时间={record.checkin_time}, "
                f"时长={record.audio.duration_seconds}秒, "
                f"音量={record.audio.avg_volume}dB, "
                f"异常数={len(record.abnormal_types)}"
            )

        scored.sort(key=lambda x: (-x[0], x[2].created_at))

        primary = scored[0][2]
        to_merge = [s[2] for s in scored[1:]]

        details.append(
            f"  → 选择记录[{primary.record_id[:8]}]为主记录 "
            f"(质量评分最高: {scored[0][0]})"
        )

        return primary, to_merge, details

    def _score_record(self, record: CheckinRecord) -> int:
        score = 0

        if not record.audio.is_blank:
            score += 50

        if record.audio.duration_seconds >= 30:
            score += 30
        elif record.audio.duration_seconds >= 15:
            score += 15

        if record.audio.avg_volume > -30:
            score += 10
        elif record.audio.avg_volume > -40:
            score += 5

        if not record.abnormal_types:
            score += 10
        else:
            score -= len(record.abnormal_types) * 5

        if not record.makeup.is_makeup:
            score += 5

        return score

    def merge_group(
        self,
        group: DuplicateGroup,
        auto_confirm: bool = False
    ) -> MergeResult:
        if group.size < 2:
            return MergeResult(
                merged=False,
                primary_record=None,
                merged_records=[],
                details=["无需合并：记录不足2条"]
            )

        primary, to_merge, details = self.select_primary(group)

        for merged_record in to_merge:
            merge_detail = self._build_merge_detail(primary, merged_record)
            details.append(merge_detail)

            if AbnormalType.DUPLICATE not in merged_record.abnormal_types:
                merged_record.abnormal_types.append(AbnormalType.DUPLICATE)
            merged_record.abnormal_details.append(
                f"同日重复上传，已合并至记录[{primary.record_id[:8]}]"
            )
            merged_record.status = RecordStatus.MERGED
            merged_record.merged_into = primary.record_id
            merged_record.updated_at = datetime.now().isoformat()

        primary.merged_from.extend([r.record_id for r in to_merge])
        if AbnormalType.DUPLICATE not in primary.abnormal_types:
            primary.abnormal_types.append(AbnormalType.DUPLICATE)
        primary.abnormal_details.append(
            f"合并了{len(to_merge)}条同日重复记录: "
            f"{', '.join([r.record_id[:8] for r in to_merge])}"
        )
        primary.updated_at = datetime.now().isoformat()

        return MergeResult(
            merged=True,
            primary_record=primary,
            merged_records=to_merge,
            details=details
        )

    def _build_merge_detail(
        self,
        primary: CheckinRecord,
        merged: CheckinRecord
    ) -> str:
        diffs = []

        if primary.audio.duration_seconds != merged.audio.duration_seconds:
            diffs.append(
                f"时长: {merged.audio.duration_seconds}秒 → "
                f"{primary.audio.duration_seconds}秒"
            )

        if primary.audio.avg_volume != merged.audio.avg_volume:
            diffs.append(
                f"音量: {merged.audio.avg_volume}dB → "
                f"{primary.audio.avg_volume}dB"
            )

        if len(primary.abnormal_types) != len(merged.abnormal_types):
            diffs.append(
                f"异常数: {len(merged.abnormal_types)} → "
                f"{len(primary.abnormal_types)}"
            )

        if primary.checkin_time != merged.checkin_time:
            diffs.append(
                f"提交时间: {merged.checkin_time} → {primary.checkin_time}"
            )

        diff_str = "; ".join(diffs) if diffs else "内容相似"

        return (
            f"  合并记录[{merged.record_id[:8]}] → "
            f"[{primary.record_id[:8]}]: {diff_str}"
        )

    def merge_all(
        self,
        records: List[CheckinRecord],
        auto_confirm: bool = True
    ) -> Tuple[List[CheckinRecord], Dict[str, Any]]:
        groups = self.find_duplicates(records)
        results: List[MergeResult] = []
        merge_details: List[str] = []

        total_duplicates = len(groups)
        total_merged = 0

        for group in groups:
            result = self.merge_group(group, auto_confirm)
            if result.merged:
                results.append(result)
                total_merged += len(result.merged_records)
                merge_details.append(
                    f"学生[{group.student_id}]在{group.checkin_date} "
                    f"有{group.size}条重复记录，已合并为1条"
                )
                merge_details.extend(result.details)

        summary = {
            "total_duplicate_groups": total_duplicates,
            "total_merged_records": total_merged,
            "remaining_records": len(records) - total_merged,
            "details": merge_details
        }

        return records, summary

    def get_duplicate_summary(
        self,
        records: List[CheckinRecord]
    ) -> Dict[str, Any]:
        groups = self.find_duplicates(records)
        merged_records = [
            r for r in records if r.status == RecordStatus.MERGED
        ]

        by_student: Dict[str, int] = defaultdict(int)
        for g in groups:
            by_student[g.student_id] += g.size

        return {
            "total_groups": len(groups),
            "total_duplicates": sum(g.size for g in groups),
            "total_merged": len(merged_records),
            "by_student": dict(by_student),
            "groups": [
                {
                    "student_id": g.student_id,
                    "date": g.checkin_date,
                    "count": g.size,
                    "record_ids": [r.record_id for r in g.records]
                }
                for g in groups
            ]
        }

    def persist_records(self, records: List[CheckinRecord]):
        data = [r.to_dict() for r in records]
        save_json(RECORDS_FILE, data, save_history=True)
