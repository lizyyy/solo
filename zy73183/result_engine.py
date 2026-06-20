from typing import List, Optional

from config import FILTER_CATEGORIES, REQUIRED_FIELDS
from models import (
    FilterCriteria,
    RawRecord,
    RecordStatus,
    Statistics,
    UnifiedResultSet,
    ValidatedRecord,
)
from unit_validator import validate_record
from utils import compute_source_hash, safe_div


def validate_raw_records(records: List[RawRecord]) -> List[ValidatedRecord]:
    return [validate_record(r) for r in records]


def apply_filters(
    records: List[ValidatedRecord],
    criteria: FilterCriteria,
) -> List[ValidatedRecord]:
    result = []
    for vr in records:
        r = vr.raw
        if criteria.category and criteria.category != "全部":
            if r.category != criteria.category:
                continue
        if criteria.status_filter:
            if vr.status not in criteria.status_filter:
                continue
        if criteria.start_date and r.submitted_at:
            if r.submitted_at < criteria.start_date:
                continue
        if criteria.end_date and r.submitted_at:
            if r.submitted_at > criteria.end_date:
                continue
        if criteria.keyword:
            kw = criteria.keyword.lower()
            haystack = f"{r.record_id} {r.category} {r.metric_name} {r.source} {r.supplementary_note or ''}".lower()
            if kw not in haystack:
                continue
        result.append(vr)
    return result


def compute_statistics(records: List[ValidatedRecord]) -> Statistics:
    stats = Statistics()
    stats.total_count = len(records)
    by_category = {}
    release_values = []

    for vr in records:
        cat = vr.raw.category or "未分类"
        by_category[cat] = by_category.get(cat, 0) + 1

        if vr.status == RecordStatus.NORMAL:
            stats.normal_count += 1
        elif vr.status == RecordStatus.UNIT_MISSING:
            stats.unit_missing_count += 1
        elif vr.status == RecordStatus.UNIT_INCONSISTENT:
            stats.unit_inconsistent_count += 1
        elif vr.status == RecordStatus.LATE_ARRIVAL:
            stats.late_arrival_count += 1
        elif vr.status == RecordStatus.SUPPLEMENTARY:
            stats.supplementary_count += 1
        elif vr.status == RecordStatus.PENDING_REVIEW:
            stats.pending_review_count += 1

        if vr.can_release:
            stats.can_release_count += 1
            if vr.standard_value is not None:
                release_values.append(vr.standard_value)
        else:
            stats.need_supplement_count += 1

    stats.by_category = by_category
    if release_values:
        stats.total_standard_value = sum(release_values)
        stats.avg_standard_value = safe_div(stats.total_standard_value, len(release_values))
    return stats


def build_unified_result(
    raw_records: List[RawRecord],
    filter_criteria: Optional[FilterCriteria] = None,
) -> UnifiedResultSet:
    if filter_criteria is None:
        filter_criteria = FilterCriteria()

    all_validated = validate_raw_records(raw_records)
    filtered = apply_filters(all_validated, filter_criteria)
    stats = compute_statistics(filtered)
    source_hash = compute_source_hash(raw_records)

    return UnifiedResultSet(
        filter_criteria=filter_criteria,
        all_records=all_validated,
        filtered_records=filtered,
        statistics=stats,
        source_hash=source_hash,
    )


def rebuild_with_same_criteria(
    new_raw_records: List[RawRecord],
    previous_result: UnifiedResultSet,
) -> UnifiedResultSet:
    return build_unified_result(new_raw_records, previous_result.filter_criteria)


def describe_filter(criteria: FilterCriteria) -> str:
    parts = []
    if criteria.category and criteria.category != "全部":
        parts.append(f"分类: {criteria.category}")
    else:
        parts.append("分类: 全部")
    if criteria.status_filter:
        labels = [s.value for s in criteria.status_filter]
        parts.append(f"状态: {', '.join(labels)}")
    if criteria.keyword:
        parts.append(f"关键词: {criteria.keyword}")
    if criteria.start_date:
        parts.append(f"起始时间: {criteria.start_date.strftime('%Y-%m-%d')}")
    if criteria.end_date:
        parts.append(f"截止时间: {criteria.end_date.strftime('%Y-%m-%d')}")
    return "；".join(parts) if parts else "无筛选条件"
