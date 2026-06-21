from typing import List, Dict, Any
from datetime import datetime
from collections import Counter
from .models import (
    CleanedRecord,
    CleanSummary,
    AnomalyType,
    FailReason,
    ReviewStatus,
)


def build_summary(
    cleaned_records: List[CleanedRecord],
    duplicates: List[Dict],
    batch_id: str,
    fail_reason_counts: Dict[str, int],
) -> CleanSummary:
    total = len(cleaned_records)
    anomaly_records = sum(1 for r in cleaned_records if r.has_anomaly)
    valid_records = sum(1 for r in cleaned_records if r.is_valid)

    anomaly_by_type: Dict[str, int] = {}
    for rec in cleaned_records:
        for a in rec.anomalies:
            key = a.anomaly_type.value
            anomaly_by_type[key] = anomaly_by_type.get(key, 0) + 1

    manual_pending = sum(
        1 for r in cleaned_records
        if r.has_anomaly and r.review is None
    )
    manual_overridden = sum(
        1 for r in cleaned_records
        if r.review and r.review.status == ReviewStatus.MANUAL_OVERRIDDEN
    )

    return CleanSummary(
        total_records=total,
        valid_records=valid_records,
        anomaly_records=anomaly_records,
        anomaly_by_type=anomaly_by_type,
        duplicate_bottles=duplicates,
        fail_reason_counts=fail_reason_counts,
        manual_review_pending=manual_pending,
        manual_review_overridden=manual_overridden,
        run_time=datetime.now().isoformat(),
        batch_id=batch_id,
    )


def summary_to_dict(summary: CleanSummary) -> Dict[str, Any]:
    return {
        "batch_id": summary.batch_id,
        "run_time": summary.run_time,
        "total_records": summary.total_records,
        "valid_records": summary.valid_records,
        "anomaly_records": summary.anomaly_records,
        "valid_rate": round(summary.valid_records / summary.total_records * 100, 2) if summary.total_records > 0 else 0,
        "anomaly_by_type": summary.anomaly_by_type,
        "duplicate_bottles": summary.duplicate_bottles,
        "duplicate_bottle_count": len(summary.duplicate_bottles),
        "fail_reason_counts": summary.fail_reason_counts,
        "manual_review_pending": summary.manual_review_pending,
        "manual_review_overridden": summary.manual_review_overridden,
    }


def record_to_dict(rec: CleanedRecord) -> Dict[str, Any]:
    return {
        "record_id": rec.record_id,
        "station": rec.station,
        "bottle_id": rec.bottle_id,
        "depth_m": rec.depth_m,
        "temperature_c": rec.temperature_c,
        "salinity_psu": rec.salinity_psu,
        "latitude": rec.latitude,
        "longitude": rec.longitude,
        "sample_time": rec.sample_time,
        "is_valid": rec.is_valid,
        "anomalies": [
            {
                "type": a.anomaly_type.value,
                "field": a.field_name,
                "message": a.message,
                "fail_reason": a.fail_reason.value if a.fail_reason else None,
                "detail": a.detail,
            }
            for a in rec.anomalies
        ],
        "review": {
            "review_id": rec.review.review_id,
            "reviewer": rec.review.reviewer,
            "review_time": rec.review.review_time.isoformat(),
            "status": rec.review.status.value,
            "fail_reason": rec.review.fail_reason.value,
            "field_name": rec.review.field_name,
            "original_value": rec.review.original_value,
            "overridden_value": rec.review.overridden_value,
            "justification": rec.review.justification,
            "source_note": rec.review.source_note,
        } if rec.review else None,
    }


def get_anomaly_detail(cleaned_records: List[CleanedRecord], anomaly_type: str = None) -> List[Dict]:
    result = []
    for rec in cleaned_records:
        for a in rec.anomalies:
            if anomaly_type and a.anomaly_type.value != anomaly_type:
                continue
            result.append({
                "record_id": rec.record_id,
                "station": rec.station,
                "bottle_id": rec.bottle_id,
                "anomaly_type": a.anomaly_type.value,
                "field_name": a.field_name,
                "message": a.message,
                "fail_reason": a.fail_reason.value if a.fail_reason else None,
                "detail": a.detail,
            })
    return result


def get_duplicate_detail(duplicates: List[Dict]) -> List[Dict]:
    return duplicates


def get_pending_review_records(cleaned_records: List[CleanedRecord]) -> List[Dict]:
    return [
        record_to_dict(r) for r in cleaned_records
        if r.has_anomaly and not r.review
    ]
