from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from app import models, schemas


def create_research_group(db: Session, group: schemas.ResearchGroupCreate):
    db_group = models.ResearchGroup(**group.model_dump())
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


def get_research_group(db: Session, group_id: int):
    return db.query(models.ResearchGroup).filter(models.ResearchGroup.id == group_id).first()


def get_research_groups(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ResearchGroup).offset(skip).limit(limit).all()


def create_instrument(db: Session, instrument: schemas.InstrumentCreate):
    db_instrument = models.Instrument(**instrument.model_dump())
    db.add(db_instrument)
    db.commit()
    db.refresh(db_instrument)
    return db_instrument


def get_instrument(db: Session, instrument_id: int):
    return db.query(models.Instrument).filter(models.Instrument.id == instrument_id).first()


def get_instruments(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(models.Instrument)
    if status:
        query = query.filter(models.Instrument.status == status)
    return query.offset(skip).limit(limit).all()


def check_time_conflict(db: Session, instrument_id: int, start_time: datetime, end_time: datetime, exclude_reservation_id: int = None):
    query = db.query(models.Reservation).filter(
        and_(
            models.Reservation.instrument_id == instrument_id,
            models.Reservation.status.in_(["pending", "confirmed", "in_use"]),
            or_(
                and_(models.Reservation.start_time <= start_time, models.Reservation.end_time > start_time),
                and_(models.Reservation.start_time < end_time, models.Reservation.end_time >= end_time),
                and_(models.Reservation.start_time >= start_time, models.Reservation.end_time <= end_time)
            )
        )
    )
    if exclude_reservation_id:
        query = query.filter(models.Reservation.id != exclude_reservation_id)
    return query.first() is not None


def create_reservation(db: Session, reservation: schemas.ReservationCreate):
    instrument = get_instrument(db, reservation.instrument_id)
    if not instrument:
        raise ValueError("Instrument not found")
    
    group = get_research_group(db, reservation.group_id)
    if not group:
        raise ValueError("Research group not found")
    
    if group.credit_score < 60:
        raise ValueError("Group credit score too low, cannot make reservation")
    
    duration = (reservation.end_time - reservation.start_time).total_seconds() / 3600
    if duration <= 0 or duration > instrument.max_reservation_hours:
        raise ValueError(f"Invalid duration. Max allowed: {instrument.max_reservation_hours} hours")
    
    if check_time_conflict(db, reservation.instrument_id, reservation.start_time, reservation.end_time):
        raise ValueError("Time slot conflict")
    
    db_reservation = models.Reservation(**reservation.model_dump())
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    return db_reservation


def get_reservation(db: Session, reservation_id: int):
    return db.query(models.Reservation).filter(models.Reservation.id == reservation_id).first()


def get_reservations(db: Session, skip: int = 0, limit: int = 100, instrument_id: int = None, group_id: int = None, status: str = None):
    query = db.query(models.Reservation)
    if instrument_id:
        query = query.filter(models.Reservation.instrument_id == instrument_id)
    if group_id:
        query = query.filter(models.Reservation.group_id == group_id)
    if status:
        query = query.filter(models.Reservation.status == status)
    return query.order_by(models.Reservation.start_time.desc()).offset(skip).limit(limit).all()


def update_reservation_status(db: Session, reservation_id: int, new_status: str):
    reservation = get_reservation(db, reservation_id)
    if not reservation:
        raise ValueError("Reservation not found")
    reservation.status = new_status
    db.commit()
    db.refresh(reservation)
    return reservation


def create_sample_risk(db: Session, risk: schemas.SampleRiskCreate):
    reservation = get_reservation(db, risk.reservation_id)
    if not reservation:
        raise ValueError("Reservation not found")
    
    instrument = get_instrument(db, reservation.instrument_id)
    if instrument.requires_risk_assessment and risk.risk_level not in ["low", "medium", "high"]:
        raise ValueError("Invalid risk level")
    
    db_risk = models.SampleRisk(**risk.model_dump())
    db.add(db_risk)
    db.commit()
    db.refresh(db_risk)
    return db_risk


def approve_sample_risk(db: Session, risk_id: int, approval: schemas.SampleRiskApprove):
    risk = db.query(models.SampleRisk).filter(models.SampleRisk.id == risk_id).first()
    if not risk:
        raise ValueError("Risk assessment not found")
    risk.approved = approval.approved
    risk.approved_by = approval.approved_by
    risk.approved_at = datetime.now()
    
    if approval.approved:
        reservation = get_reservation(db, risk.reservation_id)
        reservation.status = "confirmed"
    
    db.commit()
    db.refresh(risk)
    return risk


def get_sample_risks(db: Session, skip: int = 0, limit: int = 100, reservation_id: int = None):
    query = db.query(models.SampleRisk)
    if reservation_id:
        query = query.filter(models.SampleRisk.reservation_id == reservation_id)
    return query.offset(skip).limit(limit).all()


def cancel_reservation(db: Session, cancellation: schemas.CancellationRecordCreate):
    reservation = get_reservation(db, cancellation.reservation_id)
    if not reservation:
        raise ValueError("Reservation not found")
    
    if reservation.status in ["completed", "cancelled"]:
        raise ValueError("Reservation cannot be cancelled")
    
    hours_before_start = (reservation.start_time - datetime.now()).total_seconds() / 3600
    
    penalty_amount = 0.0
    if hours_before_start < 24:
        duration = (reservation.end_time - reservation.start_time).total_seconds() / 3600
        instrument = get_instrument(db, reservation.instrument_id)
        if hours_before_start < 6:
            penalty_amount = duration * instrument.hourly_rate
        else:
            penalty_amount = duration * instrument.hourly_rate * 0.5
    
    reservation.status = "cancelled"
    
    db_cancellation = models.CancellationRecord(
        **cancellation.model_dump(),
        penalty_amount=penalty_amount,
        penalty_applied=penalty_amount > 0
    )
    db.add(db_cancellation)
    
    if penalty_amount > 0:
        group = get_research_group(db, reservation.group_id)
        group.credit_score = max(0, group.credit_score - penalty_amount / 200)
    
    db.commit()
    db.refresh(db_cancellation)
    return db_cancellation


def get_cancellation_records(db: Session, skip: int = 0, limit: int = 100, reservation_id: int = None):
    query = db.query(models.CancellationRecord)
    if reservation_id:
        query = query.filter(models.CancellationRecord.reservation_id == reservation_id)
    return query.offset(skip).limit(limit).all()


def create_usage_report(db: Session, report: schemas.UsageReportCreate):
    reservation = get_reservation(db, report.reservation_id)
    if not reservation:
        raise ValueError("Reservation not found")
    
    actual_start = report.actual_start_time or reservation.start_time
    actual_end = report.actual_end_time or datetime.now()
    
    actual_duration = (actual_end - actual_start).total_seconds() / 3600
    scheduled_duration = (reservation.end_time - reservation.start_time).total_seconds() / 3600
    exceeded_hours = max(0, actual_duration - scheduled_duration)
    
    instrument = get_instrument(db, reservation.instrument_id)
    overtime_penalty = exceeded_hours * instrument.hourly_rate * 1.5
    total_cost = scheduled_duration * instrument.hourly_rate + overtime_penalty
    
    db_report = models.UsageReport(
        **report.model_dump(exclude={'actual_start_time', 'actual_end_time'}),
        instrument_id=reservation.instrument_id,
        group_id=reservation.group_id,
        actual_start_time=actual_start,
        actual_end_time=actual_end,
        actual_duration_hours=actual_duration,
        exceeded_hours=exceeded_hours,
        overtime_penalty=overtime_penalty,
        total_cost=total_cost
    )
    db.add(db_report)
    
    reservation.status = "completed"
    group = get_research_group(db, reservation.group_id)
    
    if overtime_penalty > 0:
        group.credit_score = max(0, group.credit_score - overtime_penalty / 200)
    
    if report.sample_contamination:
        instrument.status = "maintenance"
        group.credit_score = max(0, group.credit_score - 20)
    
    db.commit()
    db.refresh(db_report)
    return db_report


def get_usage_reports(db: Session, skip: int = 0, limit: int = 100, instrument_id: int = None, group_id: int = None):
    query = db.query(models.UsageReport)
    if instrument_id:
        query = query.filter(models.UsageReport.instrument_id == instrument_id)
    if group_id:
        query = query.filter(models.UsageReport.group_id == group_id)
    return query.order_by(models.UsageReport.submitted_at.desc()).offset(skip).limit(limit).all()


def log_exception(db: Session, exception_log: schemas.ExceptionLogCreate):
    db_log = models.ExceptionLog(**exception_log.model_dump())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def handle_exception(db: Session, exception_id: int, handling: schemas.ExceptionLogHandle):
    log = db.query(models.ExceptionLog).filter(models.ExceptionLog.id == exception_id).first()
    if not log:
        raise ValueError("Exception log not found")
    log.handling_conclusion = handling.handling_conclusion
    log.handled_by = handling.handled_by
    log.handled_at = datetime.now()
    log.resolved = True
    db.commit()
    db.refresh(log)
    return log


def get_exception_logs(db: Session, skip: int = 0, limit: int = 100, resolved: bool = None):
    query = db.query(models.ExceptionLog)
    if resolved is not None:
        query = query.filter(models.ExceptionLog.resolved == resolved)
    return query.order_by(models.ExceptionLog.created_at.desc()).offset(skip).limit(limit).all()


def apply_manual_correction(db: Session, correction: schemas.ManualCorrection):
    reservation = get_reservation(db, correction.reservation_id)
    if not reservation:
        raise ValueError("Reservation not found")
    
    if correction.new_status:
        reservation.status = correction.new_status
    if correction.new_start_time:
        reservation.start_time = correction.new_start_time
    if correction.new_end_time:
        reservation.end_time = correction.new_end_time
    
    if correction.waive_penalty:
        cancellation = db.query(models.CancellationRecord).filter(
            models.CancellationRecord.reservation_id == correction.reservation_id
        ).first()
        if cancellation:
            cancellation.penalty_applied = False
            
            group = get_research_group(db, reservation.group_id)
            group.credit_score = min(100, group.credit_score + cancellation.penalty_amount / 200)
    
    db.commit()
    db.refresh(reservation)
    return reservation
