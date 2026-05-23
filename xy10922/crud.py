from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import datetime, timedelta
import models
import schemas
import uuid


def create_visitor(db: Session, visitor: schemas.VisitorCreate):
    db_visitor = models.Visitor(**visitor.model_dump())
    db.add(db_visitor)
    db.commit()
    db.refresh(db_visitor)
    return db_visitor


def get_visitor(db: Session, visitor_id: int):
    return db.query(models.Visitor).filter(models.Visitor.id == visitor_id).first()


def get_visitors(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Visitor).offset(skip).limit(limit).all()


def create_parking_spot(db: Session, spot: schemas.ParkingSpotCreate):
    db_spot = models.ParkingSpot(**spot.model_dump())
    db.add(db_spot)
    db.commit()
    db.refresh(db_spot)
    return db_spot


def get_parking_spot(db: Session, spot_id: int):
    return db.query(models.ParkingSpot).filter(models.ParkingSpot.id == spot_id).first()


def get_parking_spot_by_number(db: Session, spot_number: str):
    return db.query(models.ParkingSpot).filter(models.ParkingSpot.spot_number == spot_number).first()


def get_parking_spots(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(models.ParkingSpot)
    if status:
        query = query.filter(models.ParkingSpot.status == status)
    return query.offset(skip).limit(limit).all()


def update_parking_spot(db: Session, spot_id: int, spot_update: schemas.ParkingSpotUpdate):
    db_spot = get_parking_spot(db, spot_id)
    if db_spot:
        for key, value in spot_update.model_dump(exclude_unset=True).items():
            setattr(db_spot, key, value)
        db.commit()
        db.refresh(db_spot)
    return db_spot


def lock_parking_spot(db: Session, spot_id: int, appointment_id: int):
    db_spot = get_parking_spot(db, spot_id)
    if db_spot and db_spot.status == models.ParkingSpotStatus.AVAILABLE.value:
        db_spot.status = models.ParkingSpotStatus.LOCKED.value
        db.commit()
        db.refresh(db_spot)
        return db_spot
    return None


def release_parking_spot(db: Session, spot_id: int):
    db_spot = get_parking_spot(db, spot_id)
    if db_spot:
        db_spot.status = models.ParkingSpotStatus.AVAILABLE.value
        db.commit()
        db.refresh(db_spot)
    return db_spot


def create_meeting_appointment(db: Session, appointment: schemas.MeetingAppointmentCreate):
    db_appointment = models.MeetingAppointment(**appointment.model_dump())
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)

    if db_appointment.parking_spot_id:
        lock_parking_spot(db, db_appointment.parking_spot_id, db_appointment.id)

    return db_appointment


def get_meeting_appointment(db: Session, appointment_id: int):
    return db.query(models.MeetingAppointment).filter(models.MeetingAppointment.id == appointment_id).first()


def get_meeting_appointments(db: Session, skip: int = 0, limit: int = 100, status: str = None, visitor_id: int = None):
    query = db.query(models.MeetingAppointment)
    if status:
        query = query.filter(models.MeetingAppointment.status == status)
    if visitor_id:
        query = query.filter(models.MeetingAppointment.visitor_id == visitor_id)
    return query.offset(skip).limit(limit).all()


def update_meeting_appointment(db: Session, appointment_id: int, appointment_update: schemas.MeetingAppointmentUpdate):
    db_appointment = get_meeting_appointment(db, appointment_id)
    if db_appointment:
        for key, value in appointment_update.model_dump(exclude_unset=True).items():
            setattr(db_appointment, key, value)
        db.commit()
        db.refresh(db_appointment)
    return db_appointment


def cancel_meeting_appointment(db: Session, appointment_id: int, cancel_record: schemas.CancelRecordCreate):
    db_appointment = get_meeting_appointment(db, appointment_id)
    if not db_appointment:
        return None

    db_appointment.status = models.MeetingStatus.CANCELLED.value

    db_cancel = models.CancelRecord(**cancel_record.model_dump())
    db.add(db_cancel)

    if cancel_record.spot_released and db_appointment.parking_spot_id:
        release_parking_spot(db, db_appointment.parking_spot_id)

        for pass_code in db_appointment.pass_codes:
            pass_code.status = models.PassCodeStatus.CANCELLED.value

    db.commit()
    db.refresh(db_appointment)
    return db_appointment


def generate_pass_code(db: Session, appointment_id: int):
    appointment = get_meeting_appointment(db, appointment_id)
    if not appointment:
        return None

    code = str(uuid.uuid4())[:8].upper()
    expired_at = appointment.end_time

    db_pass_code = models.PassCode(
        appointment_id=appointment_id,
        code=code,
        expired_at=expired_at
    )
    db.add(db_pass_code)
    db.commit()
    db.refresh(db_pass_code)
    return db_pass_code


def get_pass_code(db: Session, code: str):
    return db.query(models.PassCode).filter(models.PassCode.code == code).first()


def verify_pass_code(db: Session, code: str, verified_by: str = None):
    db_pass_code = get_pass_code(db, code)
    if not db_pass_code:
        return None, "放行码不存在"

    now = datetime.now()
    if db_pass_code.status == models.PassCodeStatus.USED.value:
        return db_pass_code, "放行码已使用"
    if db_pass_code.status == models.PassCodeStatus.CANCELLED.value:
        return db_pass_code, "放行码已取消"
    if now > db_pass_code.expired_at:
        db_pass_code.status = models.PassCodeStatus.EXPIRED.value
        db.commit()
        return db_pass_code, "放行码已过期"

    db_pass_code.status = models.PassCodeStatus.USED.value
    db_pass_code.used_at = now
    db_pass_code.used_by = verified_by

    appointment = db_pass_code.appointment
    if appointment and appointment.parking_spot:
        appointment.parking_spot.status = models.ParkingSpotStatus.OCCUPIED.value

    db.commit()
    db.refresh(db_pass_code)
    return db_pass_code, "验证成功"


def get_pass_codes_by_appointment(db: Session, appointment_id: int):
    return db.query(models.PassCode).filter(models.PassCode.appointment_id == appointment_id).all()


def create_cancel_record(db: Session, cancel_record: schemas.CancelRecordCreate):
    db_cancel = models.CancelRecord(**cancel_record.model_dump())
    db.add(db_cancel)
    db.commit()
    db.refresh(db_cancel)
    return db_cancel


def get_cancel_records(db: Session, skip: int = 0, limit: int = 100, appointment_id: int = None):
    query = db.query(models.CancelRecord)
    if appointment_id:
        query = query.filter(models.CancelRecord.appointment_id == appointment_id)
    return query.offset(skip).limit(limit).all()


def generate_occupancy_report(db: Session, report_date: datetime = None, generated_by: str = None):
    if not report_date:
        report_date = datetime.now()

    start_of_day = report_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = report_date.replace(hour=23, minute=59, second=59, microsecond=999999)

    total_spots = db.query(func.count(models.ParkingSpot.id)).scalar()
    occupied_spots = db.query(func.count(models.ParkingSpot.id)).filter(
        models.ParkingSpot.status == models.ParkingSpotStatus.OCCUPIED.value
    ).scalar()
    available_spots = db.query(func.count(models.ParkingSpot.id)).filter(
        models.ParkingSpot.status == models.ParkingSpotStatus.AVAILABLE.value
    ).scalar()
    locked_spots = db.query(func.count(models.ParkingSpot.id)).filter(
        models.ParkingSpot.status == models.ParkingSpotStatus.LOCKED.value
    ).scalar()

    cancelled_appointments = db.query(func.count(models.MeetingAppointment.id)).filter(
        and_(
            models.MeetingAppointment.status == models.MeetingStatus.CANCELLED.value,
            models.MeetingAppointment.updated_at >= start_of_day,
            models.MeetingAppointment.updated_at <= end_of_day
        )
    ).scalar()

    released_spots = db.query(func.count(models.CancelRecord.id)).filter(
        and_(
            models.CancelRecord.spot_released == True,
            models.CancelRecord.cancelled_at >= start_of_day,
            models.CancelRecord.cancelled_at <= end_of_day
        )
    ).scalar()

    utilization_rate = (occupied_spots / total_spots * 100) if total_spots > 0 else 0

    db_report = models.OccupancyReport(
        report_date=report_date,
        total_spots=total_spots,
        occupied_spots=occupied_spots,
        available_spots=available_spots,
        locked_spots=locked_spots,
        cancelled_appointments=cancelled_appointments,
        released_spots=released_spots,
        utilization_rate=utilization_rate,
        generated_by=generated_by
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_occupancy_reports(db: Session, skip: int = 0, limit: int = 100, start_date: datetime = None, end_date: datetime = None):
    query = db.query(models.OccupancyReport)
    if start_date and end_date:
        query = query.filter(
            and_(
                models.OccupancyReport.report_date >= start_date,
                models.OccupancyReport.report_date <= end_date
            )
        )
    return query.order_by(models.OccupancyReport.report_date.desc()).offset(skip).limit(limit).all()


def log_exception(db: Session, exception_log: schemas.ExceptionLogCreate):
    db_log = models.ExceptionLog(**exception_log.model_dump())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def get_exception_logs(db: Session, skip: int = 0, limit: int = 100, processed: bool = None):
    query = db.query(models.ExceptionLog)
    if processed is not None:
        if processed:
            query = query.filter(models.ExceptionLog.processing_result.isnot(None))
        else:
            query = query.filter(models.ExceptionLog.processing_result.is_(None))
    return query.order_by(models.ExceptionLog.created_at.desc()).offset(skip).limit(limit).all()


def update_exception_log(db: Session, log_id: int, log_update: schemas.ExceptionLogUpdate):
    db_log = db.query(models.ExceptionLog).filter(models.ExceptionLog.id == log_id).first()
    if db_log:
        for key, value in log_update.model_dump(exclude_unset=True).items():
            setattr(db_log, key, value)
        db.commit()
        db.refresh(db_log)
    return db_log


def manual_correction(db: Session, correction: schemas.ManualCorrectionRequest):
    appointment = get_meeting_appointment(db, correction.appointment_id)
    if not appointment:
        return None, "预约不存在"

    if correction.new_status:
        appointment.status = correction.new_status

    if correction.new_spot_id:
        new_spot = get_parking_spot(db, correction.new_spot_id)
        if not new_spot:
            return None, "新车位不存在"
        if new_spot.status != models.ParkingSpotStatus.AVAILABLE.value:
            return None, f"新车位状态为 {new_spot.status}，不可用"

        if appointment.parking_spot_id:
            release_parking_spot(db, appointment.parking_spot_id)
        appointment.parking_spot_id = correction.new_spot_id
        locked_spot = lock_parking_spot(db, correction.new_spot_id, appointment.id)
        if not locked_spot:
            return None, "新车位锁定失败"

    appointment.request_status = models.RequestStatus.PENDING_REVIEW.value
    appointment.remarks = f"人工修正: {correction.correction_reason}"
    db.commit()
    db.refresh(appointment)
    return appointment, "修正成功，待复核"


def find_available_spot(db: Session):
    return db.query(models.ParkingSpot).filter(
        models.ParkingSpot.status == models.ParkingSpotStatus.AVAILABLE.value,
        models.ParkingSpot.is_temporary == True
    ).first()
