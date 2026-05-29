from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import (
    Schedule, ArtistAvailability, NoiseRestriction,
    ChangeoverRule, Conflict, Stage, Artist,
    ConflictType, ConflictSeverity, ConflictStatus, ScheduleStatus,
)


def _intervals_overlap(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def _get_changeover_minutes(db: Session, from_artist_id: int, to_artist_id: int, stage_id: int) -> int:
    specific = db.query(ChangeoverRule).filter(
        ChangeoverRule.from_artist_id == from_artist_id,
        ChangeoverRule.to_artist_id == to_artist_id,
        ChangeoverRule.stage_id == stage_id,
    ).first()
    if specific:
        return specific.duration_minutes

    from_artist = db.query(Artist).get(from_artist_id)
    to_artist = db.query(Artist).get(to_artist_id)
    if from_artist and to_artist and from_artist.genre and to_artist.genre:
        genre_rule = db.query(ChangeoverRule).filter(
            ChangeoverRule.from_genre == from_artist.genre,
            ChangeoverRule.to_genre == to_artist.genre,
        ).first()
        if genre_rule:
            return genre_rule.duration_minutes

    default_rule = db.query(ChangeoverRule).filter(
        ChangeoverRule.from_artist_id.is_(None),
        ChangeoverRule.to_artist_id.is_(None),
        ChangeoverRule.from_genre.is_(None),
        ChangeoverRule.to_genre.is_(None),
    ).first()
    if default_rule:
        return default_rule.duration_minutes

    return 30


def check_changeover_overlap(db: Session, schedule: Schedule) -> list[Conflict]:
    conflicts = []

    stage_schedules = db.query(Schedule).filter(
        Schedule.stage_id == schedule.stage_id,
        Schedule.id != schedule.id,
        Schedule.status != ScheduleStatus.CANCELLED,
    ).order_by(Schedule.start_time).all()

    for other in stage_schedules:
        if other.start_time >= schedule.end_time:
            needed_gap = _get_changeover_minutes(db, schedule.artist_id, other.artist_id, schedule.stage_id)
            gap_minutes = (other.start_time - schedule.end_time).total_seconds() / 60
            if gap_minutes < needed_gap:
                conflicts.append(Conflict(
                    schedule_id=schedule.id,
                    conflict_type=ConflictType.CHANGEOVER_OVERLAP,
                    severity=ConflictSeverity.CRITICAL if gap_minutes < needed_gap * 0.5 else ConflictSeverity.WARNING,
                    status=ConflictStatus.OPEN,
                    message=f"换场时间不足：{schedule.artist.name if schedule.artist else ''} 结束后到 {other.artist.name if other.artist else ''} 开场仅 {gap_minutes:.0f} 分钟，需 {needed_gap} 分钟",
                    detail=f"schedule_end={schedule.end_time.isoformat()}, next_start={other.start_time.isoformat()}, gap={gap_minutes:.0f}min, required={needed_gap}min",
                    related_schedule_id=other.id,
                ))

        elif other.end_time <= schedule.start_time:
            needed_gap = _get_changeover_minutes(db, other.artist_id, schedule.artist_id, schedule.stage_id)
            gap_minutes = (schedule.start_time - other.end_time).total_seconds() / 60
            if gap_minutes < needed_gap:
                conflicts.append(Conflict(
                    schedule_id=schedule.id,
                    conflict_type=ConflictType.CHANGEOVER_OVERLAP,
                    severity=ConflictSeverity.CRITICAL if gap_minutes < needed_gap * 0.5 else ConflictSeverity.WARNING,
                    status=ConflictStatus.OPEN,
                    message=f"换场时间不足：{other.artist.name if other.artist else ''} 结束后到 {schedule.artist.name if schedule.artist else ''} 开场仅 {gap_minutes:.0f} 分钟，需 {needed_gap} 分钟",
                    detail=f"prev_end={other.end_time.isoformat()}, schedule_start={schedule.start_time.isoformat()}, gap={gap_minutes:.0f}min, required={needed_gap}min",
                    related_schedule_id=other.id,
                ))

    return conflicts


def check_artist_late(db: Session, schedule: Schedule) -> list[Conflict]:
    conflicts = []
    availability_windows = db.query(ArtistAvailability).filter(
        ArtistAvailability.artist_id == schedule.artist_id,
    ).all()

    if not availability_windows:
        conflicts.append(Conflict(
            schedule_id=schedule.id,
            conflict_type=ConflictType.ARTIST_LATE,
            severity=ConflictSeverity.WARNING,
            status=ConflictStatus.OPEN,
            message=f"艺人 {schedule.artist.name if schedule.artist else ''} 无档期记录，无法确认可到场时间",
            detail="no_availability_record",
        ))
        return conflicts

    covered = False
    for window in availability_windows:
        if window.window_start <= schedule.start_time and schedule.end_time <= window.window_end:
            covered = True
            break

    if not covered:
        closest = None
        min_diff = float('inf')
        for window in availability_windows:
            diff = abs((window.window_start - schedule.start_time).total_seconds())
            if diff < min_diff:
                min_diff = diff
                closest = window

        is_hard = any(w.is_hard_constraint for w in availability_windows)
        severity = ConflictSeverity.CRITICAL if is_hard else ConflictSeverity.WARNING

        window_info = ""
        if closest:
            window_info = f"最近档期: {closest.window_start.strftime('%H:%M')}-{closest.window_end.strftime('%H:%M')}"
            if closest.note:
                window_info += f" ({closest.note})"

        conflicts.append(Conflict(
            schedule_id=schedule.id,
            conflict_type=ConflictType.ARTIST_LATE,
            severity=severity,
            status=ConflictStatus.OPEN,
            message=f"艺人 {schedule.artist.name if schedule.artist else ''} 排程时间不在可用档期内",
            detail=f"schedule={schedule.start_time.strftime('%H:%M')}-{schedule.end_time.strftime('%H:%M')}, {window_info}",
        ))

    same_time_other_stages = db.query(Schedule).filter(
        Schedule.artist_id == schedule.artist_id,
        Schedule.id != schedule.id,
        Schedule.status != ScheduleStatus.CANCELLED,
    ).all()
    for other in same_time_other_stages:
        if _intervals_overlap(schedule.start_time, schedule.end_time, other.start_time, other.end_time):
            conflicts.append(Conflict(
                schedule_id=schedule.id,
                conflict_type=ConflictType.DOUBLE_BOOKED,
                severity=ConflictSeverity.CRITICAL,
                status=ConflictStatus.OPEN,
                message=f"艺人 {schedule.artist.name if schedule.artist else ''} 同一时段被安排在多个舞台",
                detail=f"stage_id={schedule.stage_id} vs stage_id={other.stage_id}, other_schedule_id={other.id}",
                related_schedule_id=other.id,
            ))

    return conflicts


def check_noise_violation(db: Session, schedule: Schedule) -> list[Conflict]:
    conflicts = []
    estimated_db = schedule.estimated_volume_db
    if estimated_db is None and schedule.artist and schedule.artist.avg_volume_db:
        estimated_db = schedule.artist.avg_volume_db
    if estimated_db is None:
        return conflicts

    noise_restrictions = db.query(NoiseRestriction).filter(
        (NoiseRestriction.stage_id == schedule.stage_id) | (NoiseRestriction.stage_id.is_(None)),
    ).all()

    for restriction in noise_restrictions:
        r_start = restriction.restricted_from
        r_end = restriction.restricted_to

        if restriction.is_recurring_daily:
            r_start_time = r_start.time()
            r_end_time = r_end.time()
            s_start_time = schedule.start_time.time()
            s_end_time = schedule.end_time.time()
            time_overlaps = s_start_time < r_end_time and r_start_time < s_end_time
        else:
            time_overlaps = _intervals_overlap(schedule.start_time, schedule.end_time, r_start, r_end)

        if time_overlaps and estimated_db > restriction.max_db:
            stage_name = ""
            if restriction.stage_id:
                stage = db.query(Stage).get(restriction.stage_id)
                if stage:
                    stage_name = stage.name
            area = restriction.area_name or stage_name or f"stage_id={restriction.stage_id}"

            conflicts.append(Conflict(
                schedule_id=schedule.id,
                conflict_type=ConflictType.NOISE_VIOLATION,
                severity=ConflictSeverity.CRITICAL if estimated_db > restriction.max_db + 10 else ConflictSeverity.WARNING,
                status=ConflictStatus.OPEN,
                message=f"噪声超标：{area} 时段 {restriction.restricted_from.strftime('%H:%M')}-{restriction.restricted_to.strftime('%H:%M')} 限 {restriction.max_db}dB，预估 {estimated_db}dB",
                detail=f"restriction_id={restriction.id}, max_db={restriction.max_db}, estimated_db={estimated_db}, reason={restriction.reason}, authority={restriction.authority}",
            ))

    return conflicts


def run_full_conflict_check(db: Session, schedule: Schedule) -> list[Conflict]:
    all_conflicts = []
    all_conflicts.extend(check_changeover_overlap(db, schedule))
    all_conflicts.extend(check_artist_late(db, schedule))
    all_conflicts.extend(check_noise_violation(db, schedule))
    return all_conflicts


def recalc_conflicts_for_schedule(db: Session, schedule_id: int) -> list[Conflict]:
    db.query(Conflict).filter(
        Conflict.schedule_id == schedule_id,
        Conflict.status == ConflictStatus.OPEN,
    ).delete()
    db.flush()

    schedule = db.query(Schedule).get(schedule_id)
    if not schedule or schedule.status == ScheduleStatus.CANCELLED:
        return []

    new_conflicts = run_full_conflict_check(db, schedule)
    for c in new_conflicts:
        db.add(c)
    db.flush()
    return new_conflicts
