from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple

from .models import (
    DataQualityWarning,
    SampleRecord,
    WarningType,
)


class DataLoader:
    def __init__(self) -> None:
        self._records: List[SampleRecord] = []
        self._seen_ids: Set[str] = set()

    def add_record(self, record: SampleRecord) -> Tuple[bool, Optional[DataQualityWarning]]:
        warning = None
        if record.sample_id in self._seen_ids:
            warning = DataQualityWarning(
                warning_type=WarningType.DUPLICATE_SAMPLE,
                sample_ids=[record.sample_id],
                detail=f"样本 {record.sample_id} 重复，已跳过重复记录",
            )
            return False, warning

        self._seen_ids.add(record.sample_id)
        self._records.append(record)
        return True, None

    def add_records(
        self, records: List[SampleRecord]
    ) -> Tuple[List[SampleRecord], List[DataQualityWarning]]:
        accepted: List[SampleRecord] = []
        warnings: List[DataQualityWarning] = []
        for rec in records:
            ok, warn = self.add_record(rec)
            if ok:
                accepted.append(rec)
            if warn is not None:
                warnings.append(warn)
        return accepted, warnings

    @property
    def records(self) -> List[SampleRecord]:
        return list(self._records)


class DataQualityChecker:
    def check(self, records: List[SampleRecord]) -> List[DataQualityWarning]:
        warnings: List[DataQualityWarning] = []
        warnings.extend(self._check_null_features(records))
        warnings.extend(self._check_missing_reference(records))
        warnings.extend(self._check_label_conflict(records))
        warnings.extend(self._check_sample_leakage(records))
        return warnings

    def _check_null_features(self, records: List[SampleRecord]) -> List[DataQualityWarning]:
        warnings: List[DataQualityWarning] = []
        null_ids: List[str] = []
        for rec in records:
            has_null = any(v is None for v in rec.features.values())
            if has_null or len(rec.features) == 0:
                null_ids.append(rec.sample_id)
        if null_ids:
            warnings.append(
                DataQualityWarning(
                    warning_type=WarningType.NULL_FEATURE,
                    sample_ids=null_ids,
                    detail=f"样本 {null_ids} 存在空特征值，可能影响模型判断准确性",
                )
            )
        return warnings

    def _check_missing_reference(self, records: List[SampleRecord]) -> List[DataQualityWarning]:
        missing_ids = [r.sample_id for r in records if r.reference_result is None]
        if missing_ids:
            return [
                DataQualityWarning(
                    warning_type=WarningType.MISSING_REFERENCE,
                    sample_ids=missing_ids,
                    detail=f"样本 {missing_ids} 缺少引用结果(reference_result)，无法自动验证判断正确性",
                )
            ]
        return []

    def _check_label_conflict(self, records: List[SampleRecord]) -> List[DataQualityWarning]:
        warnings: List[DataQualityWarning] = []
        for rec in records:
            if (
                rec.original_label is not None
                and rec.human_label is not None
                and rec.original_label != rec.human_label
            ):
                warnings.append(
                    DataQualityWarning(
                        warning_type=WarningType.LABEL_CONFLICT,
                        sample_ids=[rec.sample_id],
                        detail=(
                            f"样本 {rec.sample_id} 标签冲突: "
                            f"原始标签='{rec.original_label}' vs 人工标签='{rec.human_label}'"
                        ),
                    )
                )
        return warnings

    def _check_sample_leakage(self, records: List[SampleRecord]) -> List[DataQualityWarning]:
        group_map: Dict[str, List[str]] = defaultdict(list)
        for rec in records:
            if rec.group_id is not None:
                group_map[rec.group_id].append(rec.sample_id)

        id_groups: Dict[str, Set[str]] = defaultdict(set)
        for group_id, sample_ids in group_map.items():
            for sid in sample_ids:
                id_groups[sid].add(group_id)

        leakage_ids = [sid for sid, groups in id_groups.items() if len(groups) > 1]
        if leakage_ids:
            return [
                DataQualityWarning(
                    warning_type=WarningType.SAMPLE_LEAKAGE,
                    sample_ids=leakage_ids,
                    detail=f"样本 {leakage_ids} 同时出现在多个分组中，存在数据泄漏风险",
                )
            ]
        return []
