from typing import List, Dict, Tuple
from collections import defaultdict
from .models import (
    RawSampleRecord,
    CleanedRecord,
    CleanAnomaly,
    AnomalyType,
    FailReason,
)


def detect_duplicate_bottles(records: List[RawSampleRecord]) -> List[Dict]:
    bottle_groups: Dict[str, List[RawSampleRecord]] = defaultdict(list)
    for rec in records:
        key = f"{rec.station}_{rec.bottle_id}"
        bottle_groups[key].append(rec)

    duplicates = []
    for key, group in bottle_groups.items():
        if len(group) > 1:
            duplicates.append({
                "station_bottle": key,
                "station": group[0].station,
                "bottle_id": group[0].bottle_id,
                "count": len(group),
                "record_ids": [r.record_id for r in group],
                "sample_times": [r.sample_time for r in group],
            })
    return duplicates


def apply_duplicate_detection(cleaned: List[CleanedRecord], duplicates: List[Dict]) -> List[CleanedRecord]:
    dup_record_ids = set()
    for dup in duplicates:
        dup_record_ids.update(dup["record_ids"])

    for rec in cleaned:
        if rec.record_id in dup_record_ids:
            rec.anomalies.append(CleanAnomaly(
                anomaly_type=AnomalyType.DUPLICATE_BOTTLE,
                field_name="bottle_id",
                message=f"采样瓶编号重复: {rec.bottle_id}",
                detail={"bottle_id": rec.bottle_id, "station": rec.station},
                fail_reason=FailReason.FORMAT,
            ))
    return cleaned


def detect_invalid_values(records: List[RawSampleRecord]) -> List[CleanedRecord]:
    results = []
    for rec in records:
        if rec.temperature is not None:
            try:
                float(rec.temperature)
            except (TypeError, ValueError):
                pass
        results.append(None)
    return results


def run_full_detection(raw_records: List[RawSampleRecord], cleaned_records: List[CleanedRecord]) -> Tuple[List[CleanedRecord], List[Dict]]:
    duplicates = detect_duplicate_bottles(raw_records)
    cleaned_with_dup = apply_duplicate_detection(cleaned_records, duplicates)

    for rec in cleaned_with_dup:
        rec.is_valid = rec.is_valid and not any(
            a.anomaly_type == AnomalyType.DUPLICATE_BOTTLE for a in rec.anomalies
        )

    return cleaned_with_dup, duplicates
