from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models import PracticeRecord


def compute_weekly_stats(
    db: Session,
    student_id: int,
    week_start: Optional[datetime] = None,
    week_end: Optional[datetime] = None,
) -> dict:
    query = db.query(PracticeRecord).filter(PracticeRecord.student_id == student_id)
    if week_start:
        query = query.filter(PracticeRecord.practiced_at >= week_start)
    if week_end:
        query = query.filter(PracticeRecord.practiced_at <= week_end)

    records = query.all()
    if not records:
        return _empty_stats(student_id)

    deviations = [r.mean_deviation_ms for r in records if r.mean_deviation_ms is not None]
    weak_devs = []
    strong_devs = []
    misjudgment_count = 0
    missing_seg_count = 0
    for r in records:
        if r.weak_beat_deviations:
            weak_devs.extend([d.get("deviation_ms", 0) for d in r.weak_beat_deviations])
        if r.strong_beat_deviations:
            strong_devs.extend([d.get("deviation_ms", 0) for d in r.strong_beat_deviations])
        if r.weak_beat_misjudgment_flagged:
            misjudgment_count += 1
        if r.missing_segment_flagged:
            missing_seg_count += 1

    avg_dev = sum(deviations) / len(deviations) if deviations else 0.0
    best_dev = min(deviations) if deviations else 0.0
    worst_dev = max(deviations) if deviations else 0.0
    avg_weak = sum(abs(d) for d in weak_devs) / len(weak_devs) if weak_devs else 0.0
    avg_strong = sum(abs(d) for d in strong_devs) / len(strong_devs) if strong_devs else 0.0

    return {
        "student_id": student_id,
        "week_start": week_start.isoformat() if week_start else None,
        "week_end": week_end.isoformat() if week_end else None,
        "session_count": len(records),
        "total_duration_seconds": sum(r.duration_seconds for r in records),
        "avg_deviation_ms": round(avg_dev, 2),
        "best_deviation_ms": round(best_dev, 2),
        "worst_deviation_ms": round(worst_dev, 2),
        "weak_beat_avg_deviation_ms": round(avg_weak, 2),
        "strong_beat_avg_deviation_ms": round(avg_strong, 2),
        "weak_beat_misjudgment_count": misjudgment_count,
        "missing_segment_count": missing_seg_count,
    }


def compute_segment_comparison(
    db: Session,
    student_id: int,
    week_start: Optional[datetime] = None,
    week_end: Optional[datetime] = None,
) -> list[dict]:
    query = db.query(PracticeRecord).filter(PracticeRecord.student_id == student_id)
    if week_start:
        query = query.filter(PracticeRecord.practiced_at >= week_start)
    if week_end:
        query = query.filter(PracticeRecord.practiced_at <= week_end)

    records = query.all()
    comparison = []
    for r in records:
        segments = r.bpm_change_segments or []
        entry = {
            "record_id": r.id,
            "practiced_at": r.practiced_at.isoformat(),
            "base_bpm": r.bpm,
            "missing_segment_flagged": r.missing_segment_flagged,
            "weak_beat_misjudgment_flagged": r.weak_beat_misjudgment_flagged,
            "segments": segments,
        }
        comparison.append(entry)
    return comparison


def _empty_stats(student_id: int) -> dict:
    return {
        "student_id": student_id,
        "week_start": None,
        "week_end": None,
        "session_count": 0,
        "total_duration_seconds": 0,
        "avg_deviation_ms": 0.0,
        "best_deviation_ms": 0.0,
        "worst_deviation_ms": 0.0,
        "weak_beat_avg_deviation_ms": 0.0,
        "strong_beat_avg_deviation_ms": 0.0,
        "weak_beat_misjudgment_count": 0,
        "missing_segment_count": 0,
    }
