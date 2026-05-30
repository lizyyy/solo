from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import PracticeRecord, AuditLog
from schemas import PracticeRecordCreate, PracticeRecordOut, DeviationStatsOut
from services.bpm_analyzer import (
    classify_deviations,
    detect_weak_beat_misjudgment,
    detect_missing_bpm_segments,
    compute_deviations,
)

router = APIRouter(prefix="/api/practice-records", tags=["practice-records"])


@router.post("", response_model=PracticeRecordOut)
def create_practice_record(data: PracticeRecordCreate, db: Session = Depends(get_db)):
    is_backdated = data.practiced_at < datetime.utcnow()

    existing = (
        db.query(PracticeRecord)
        .filter(
            PracticeRecord.student_id == data.student_id,
            PracticeRecord.practiced_at == data.practiced_at,
            PracticeRecord.bpm == data.bpm,
        )
        .first()
    )
    is_duplicate = existing is not None
    if is_duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "该学生同一时间同一BPM的练习记录已存在",
                "existing_record_id": existing.id,
            },
        )

    weak_beat_devs, strong_beat_devs = classify_deviations(
        data.raw_deviations, data.time_signature
    )

    mean_dev, max_dev = compute_deviations(data.raw_deviations)

    weak_misjudgment = detect_weak_beat_misjudgment(weak_beat_devs, strong_beat_devs)

    total_beats = data.duration_seconds * data.bpm // 60
    segments, missing_flagged = detect_missing_bpm_segments(
        data.bpm_change_segments, total_beats
    )

    raw_dev_dicts = [d.model_dump() for d in data.raw_deviations]
    seg_dicts = [d.model_dump() for d in data.bpm_change_segments]

    record = PracticeRecord(
        student_id=data.student_id,
        practiced_at=data.practiced_at,
        bpm=data.bpm,
        duration_seconds=data.duration_seconds,
        time_signature=data.time_signature,
        raw_deviations=raw_dev_dicts,
        mean_deviation_ms=round(mean_dev, 2),
        max_deviation_ms=round(max_dev, 2),
        weak_beat_deviations=weak_beat_devs,
        strong_beat_deviations=strong_beat_devs,
        is_backdated=is_backdated,
        is_duplicate_flagged=False,
        confirmation_status="pending",
        bpm_change_segments=segments if segments else seg_dicts,
        missing_segment_flagged=missing_flagged,
        weak_beat_misjudgment_flagged=weak_misjudgment,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    _log_audit(
        db,
        "practice_record",
        record.id,
        "create",
        None,
        {
            "student_id": data.student_id,
            "practiced_at": data.practiced_at.isoformat(),
            "bpm": data.bpm,
            "is_backdated": is_backdated,
            "missing_segment_flagged": missing_flagged,
            "weak_beat_misjudgment_flagged": weak_misjudgment,
        },
    )

    return record


@router.post("/backfill", response_model=PracticeRecordOut)
def backfill_practice_record(data: PracticeRecordCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(PracticeRecord)
        .filter(
            PracticeRecord.student_id == data.student_id,
            PracticeRecord.practiced_at == data.practiced_at,
            PracticeRecord.bpm == data.bpm,
        )
        .first()
    )
    if existing:
        existing.is_duplicate_flagged = True
        db.commit()
        db.refresh(existing)
        _log_audit(
            db,
            "practice_record",
            existing.id,
            "backfill_duplicate",
            {"is_duplicate_flagged": False},
            {"is_duplicate_flagged": True},
        )
        return existing

    weak_beat_devs, strong_beat_devs = classify_deviations(
        data.raw_deviations, data.time_signature
    )
    mean_dev, max_dev = compute_deviations(data.raw_deviations)
    weak_misjudgment = detect_weak_beat_misjudgment(weak_beat_devs, strong_beat_devs)
    total_beats = data.duration_seconds * data.bpm // 60
    segments, missing_flagged = detect_missing_bpm_segments(
        data.bpm_change_segments, total_beats
    )

    raw_dev_dicts = [d.model_dump() for d in data.raw_deviations]
    seg_dicts = [d.model_dump() for d in data.bpm_change_segments]

    record = PracticeRecord(
        student_id=data.student_id,
        practiced_at=data.practiced_at,
        bpm=data.bpm,
        duration_seconds=data.duration_seconds,
        time_signature=data.time_signature,
        raw_deviations=raw_dev_dicts,
        mean_deviation_ms=round(mean_dev, 2),
        max_deviation_ms=round(max_dev, 2),
        weak_beat_deviations=weak_beat_devs,
        strong_beat_deviations=strong_beat_devs,
        is_backdated=True,
        is_duplicate_flagged=False,
        confirmation_status="pending",
        bpm_change_segments=segments if segments else seg_dicts,
        missing_segment_flagged=missing_flagged,
        weak_beat_misjudgment_flagged=weak_misjudgment,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    _log_audit(
        db,
        "practice_record",
        record.id,
        "backfill",
        None,
        {
            "student_id": data.student_id,
            "practiced_at": data.practiced_at.isoformat(),
            "bpm": data.bpm,
            "is_backdated": True,
        },
    )

    return record


@router.get("", response_model=list[PracticeRecordOut])
def list_practice_records(
    student_id: Optional[int] = None,
    week_start: Optional[datetime] = None,
    week_end: Optional[datetime] = None,
    confirmation_status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PracticeRecord)
    if student_id:
        query = query.filter(PracticeRecord.student_id == student_id)
    if week_start:
        query = query.filter(PracticeRecord.practiced_at >= week_start)
    if week_end:
        query = query.filter(PracticeRecord.practiced_at <= week_end)
    if confirmation_status:
        query = query.filter(PracticeRecord.confirmation_status == confirmation_status)
    return query.order_by(PracticeRecord.practiced_at.desc()).all()


@router.get("/statistics", response_model=DeviationStatsOut)
def get_deviation_statistics(
    student_id: int = Query(...),
    week_start: Optional[datetime] = None,
    week_end: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    from services.deviation_stats import compute_weekly_stats

    stats = compute_weekly_stats(db, student_id, week_start, week_end)
    return stats


@router.get("/segment-comparison")
def get_segment_comparison(
    student_id: int = Query(...),
    week_start: Optional[datetime] = None,
    week_end: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    from services.deviation_stats import compute_segment_comparison

    return compute_segment_comparison(db, student_id, week_start, week_end)


def _log_audit(db, entity_type, entity_id, action, before, after):
    log = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        before_state=before,
        after_state=after,
        operator="system",
    )
    db.add(log)
    db.commit()
