from typing import Optional
import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Schedule, Conflict, ConflictType, ConflictStatus, ArtistAvailability, NoiseRestriction
from app.schemas import ScheduleReport, ScheduleReportItem, ScheduleRead, ConflictRead

router = APIRouter(prefix="/reports", tags=["reports"])


def _enrich_schedule(s: Schedule) -> ScheduleRead:
    d = ScheduleRead.model_validate(s)
    if s.artist:
        d.artist_name = s.artist.name
    if s.stage:
        d.stage_name = s.stage.name
    return d


@router.get("/schedule-overview", response_model=ScheduleReport)
def schedule_overview(
    stage_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Schedule).filter(Schedule.status != "cancelled")
    if stage_id:
        q = q.filter(Schedule.stage_id == stage_id)
    schedules = q.order_by(Schedule.start_time).all()

    items = []
    total_conflicts = 0
    critical_conflicts = 0

    for s in schedules:
        conflicts = db.query(Conflict).filter(Conflict.schedule_id == s.id).all()
        conflict_reads = [ConflictRead.model_validate(c) for c in conflicts]
        total_conflicts += len(conflict_reads)
        critical_conflicts += sum(1 for c in conflict_reads if c.severity.value == "critical")

        avail_windows = db.query(ArtistAvailability).filter(
            ArtistAvailability.artist_id == s.artist_id,
        ).all()
        artist_ok = any(
            w.window_start <= s.start_time and s.end_time <= w.window_end
            for w in avail_windows
        ) if avail_windows else False

        estimated_db = s.estimated_volume_db or (s.artist.avg_volume_db if s.artist else None)
        noise_restrictions = db.query(NoiseRestriction).filter(
            (NoiseRestriction.stage_id == s.stage_id) | (NoiseRestriction.stage_id.is_(None)),
        ).all()
        noise_ok = True
        if estimated_db:
            for r in noise_restrictions:
                if estimated_db > r.max_db:
                    noise_ok = False
                    break

        changeover_ok = not any(c.conflict_type == ConflictType.CHANGEOVER_OVERLAP for c in conflicts)

        items.append(ScheduleReportItem(
            schedule=_enrich_schedule(s),
            conflicts=conflict_reads,
            artist_availability_ok=artist_ok,
            noise_ok=noise_ok,
            changeover_ok=changeover_ok,
        ))

    return ScheduleReport(
        generated_at=datetime.utcnow(),
        total_schedules=len(schedules),
        total_conflicts=total_conflicts,
        critical_conflicts=critical_conflicts,
        items=items,
    )


@router.get("/export-csv")
def export_csv(
    stage_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Schedule).filter(Schedule.status != "cancelled")
    if stage_id:
        q = q.filter(Schedule.stage_id == stage_id)
    schedules = q.order_by(Schedule.start_time).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "排程ID", "艺人", "舞台", "开始时间", "结束时间", "状态",
        "换场前(分)", "换场后(分)", "预估音量dB", "排程员",
        "冲突数", "冲突类型", "冲突严重度", "冲突状态", "备注",
    ])

    for s in schedules:
        conflicts = db.query(Conflict).filter(Conflict.schedule_id == s.id).all()
        artist_name = s.artist.name if s.artist else ""
        stage_name = s.stage.name if s.stage else ""
        conflict_summary = "; ".join(
            f"{c.conflict_type.value}({c.severity.value})" for c in conflicts
        ) if conflicts else "无"

        writer.writerow([
            s.id, artist_name, stage_name,
            s.start_time.strftime("%Y-%m-%d %H:%M"),
            s.end_time.strftime("%Y-%m-%d %H:%M"),
            s.status.value if s.status else "",
            s.changeover_before_minutes,
            s.changeover_after_minutes,
            s.estimated_volume_db or "",
            s.assigned_by or "",
            len(conflicts),
            conflict_summary,
            "; ".join(c.severity.value for c in conflicts) if conflicts else "",
            "; ".join(c.status.value for c in conflicts) if conflicts else "",
            s.note or "",
        ])

    output.seek(0)
    filename = f"schedule_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
