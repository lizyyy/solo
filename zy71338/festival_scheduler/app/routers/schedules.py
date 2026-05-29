from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Schedule, ScheduleHistory, Conflict, ScheduleStatus, ConflictStatus
from app.schemas import (
    ScheduleCreate, ScheduleUpdate, ScheduleRead, ScheduleHistoryRead,
    ConflictRead, ConflictCheckResult, ErrorResponse,
)
from app.engine import run_full_conflict_check, recalc_conflicts_for_schedule

router = APIRouter(prefix="/schedules", tags=["schedules"])


def _enrich_schedule(s: Schedule) -> ScheduleRead:
    d = ScheduleRead.model_validate(s)
    if s.artist:
        d.artist_name = s.artist.name
    if s.stage:
        d.stage_name = s.stage.name
    return d


@router.get("/", response_model=List[ScheduleRead])
def list_schedules(
    stage_id: Optional[int] = Query(None),
    artist_id: Optional[int] = Query(None),
    status: Optional[ScheduleStatus] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Schedule)
    if stage_id:
        q = q.filter(Schedule.stage_id == stage_id)
    if artist_id:
        q = q.filter(Schedule.artist_id == artist_id)
    if status:
        q = q.filter(Schedule.status == status)
    return [_enrich_schedule(s) for s in q.order_by(Schedule.start_time).all()]


@router.get("/{schedule_id}", response_model=ScheduleRead, responses={404: {"model": ErrorResponse}})
def get_schedule(schedule_id: int, db: Session = Depends(get_db)):
    s = db.query(Schedule).get(schedule_id)
    if not s:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "排程不存在", "detail": f"schedule_id={schedule_id}"})
    return _enrich_schedule(s)


@router.post("/", response_model=ScheduleRead, status_code=201)
def create_schedule(data: ScheduleCreate, db: Session = Depends(get_db)):
    if data.start_time >= data.end_time:
        raise HTTPException(status_code=422, detail={"code": 422, "message": "开始时间必须早于结束时间"})

    schedule = Schedule(**data.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    conflicts = run_full_conflict_check(db, schedule)
    for c in conflicts:
        db.add(c)
    db.commit()
    db.refresh(schedule)

    return _enrich_schedule(schedule)


@router.patch("/{schedule_id}", response_model=ScheduleRead, responses={404: {"model": ErrorResponse}})
def update_schedule(schedule_id: int, data: ScheduleUpdate, db: Session = Depends(get_db)):
    schedule = db.query(Schedule).get(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "排程不存在", "detail": f"schedule_id={schedule_id}"})

    update_data = data.model_dump(exclude_unset=True)
    change_reason = update_data.pop("change_reason", None)

    for field in ("start_time", "end_time", "stage_id", "artist_id", "status",
                  "changeover_before_minutes", "changeover_after_minutes",
                  "estimated_volume_db", "assigned_by", "note"):
        if field in update_data:
            old_val = getattr(schedule, field)
            new_val = update_data[field]
            if old_val != new_val:
                history = ScheduleHistory(
                    schedule_id=schedule_id,
                    change_type="update",
                    field_name=field,
                    old_value=str(old_val) if old_val is not None else None,
                    new_value=str(new_val) if new_val is not None else None,
                    changed_by=update_data.get("assigned_by"),
                    change_reason=change_reason,
                )
                db.add(history)
                setattr(schedule, field, new_val)

    db.commit()
    db.refresh(schedule)

    recalc_conflicts_for_schedule(db, schedule_id)
    db.commit()
    db.refresh(schedule)

    return _enrich_schedule(schedule)


@router.delete("/{schedule_id}", status_code=204, responses={404: {"model": ErrorResponse}})
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(Schedule).get(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "排程不存在", "detail": f"schedule_id={schedule_id}"})

    history = ScheduleHistory(
        schedule_id=schedule_id,
        change_type="delete",
        field_name="status",
        old_value=schedule.status.value if schedule.status else None,
        new_value="deleted",
        change_reason="schedule_deleted",
    )
    db.add(history)
    db.delete(schedule)
    db.commit()


@router.post("/{schedule_id}/check-conflicts", response_model=ConflictCheckResult, responses={404: {"model": ErrorResponse}})
def check_conflicts(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(Schedule).get(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "排程不存在", "detail": f"schedule_id={schedule_id}"})

    conflicts = recalc_conflicts_for_schedule(db, schedule_id)
    db.commit()
    schedule = db.query(Schedule).get(schedule_id)

    return ConflictCheckResult(
        schedule_id=schedule_id,
        has_conflicts=len(conflicts) > 0,
        conflicts=[ConflictRead.model_validate(c) for c in schedule.conflicts],
    )


@router.get("/{schedule_id}/history", response_model=List[ScheduleHistoryRead], responses={404: {"model": ErrorResponse}})
def get_schedule_history(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(Schedule).get(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "排程不存在", "detail": f"schedule_id={schedule_id}"})
    return [ScheduleHistoryRead.model_validate(h) for h in schedule.history_entries]
