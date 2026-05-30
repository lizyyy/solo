from datetime import datetime, date
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import uuid

from app import models, schemas


class RoomRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, room: schemas.RoomCreate) -> models.Room:
        db_room = models.Room(
            name=room.name,
            capacity=room.capacity,
            location=room.location,
            description=room.description
        )
        self.db.add(db_room)
        self.db.flush()
        for eq in room.equipment:
            db_room_eq = models.RoomEquipment(
                room_id=db_room.id,
                equipment_id=eq.equipment_id,
                quantity=eq.quantity,
                source_note=eq.source_note
            )
            self.db.add(db_room_eq)
        self.db.commit()
        self.db.refresh(db_room)
        return db_room

    def get_by_id(self, room_id: int) -> Optional[models.Room]:
        return self.db.query(models.Room).filter(models.Room.id == room_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[models.Room]:
        return self.db.query(models.Room).filter(models.Room.is_active == True).offset(skip).limit(limit).all()

    def get_available_rooms(self, capacity_required: int, date_val: date, start_time: str, end_time: str) -> List[models.Room]:
        scheduled_rooms = self.db.query(models.Schedule.room_id).filter(
            and_(
                models.Schedule.scheduled_date == date_val,
                models.Schedule.start_time < end_time,
                models.Schedule.end_time > start_time
            )
        ).subquery()
        return self.db.query(models.Room).filter(
            and_(
                    models.Room.is_active == True,
                    models.Room.capacity >= capacity_required,
                    models.Room.id.notin_(scheduled_rooms)
                )
        ).all()


class EquipmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, equipment: schemas.EquipmentCreate) -> models.Equipment:
        db_equipment = models.Equipment(**equipment.model_dump())
        self.db.add(db_equipment)
        self.db.commit()
        self.db.refresh(db_equipment)
        return db_equipment

    def get_by_id(self, equipment_id: int) -> Optional[models.Equipment]:
        return self.db.query(models.Equipment).filter(models.Equipment.id == equipment_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[models.Equipment]:
        return self.db.query(models.Equipment).offset(skip).limit(limit).all()


class BandRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, band: schemas.BandCreate) -> models.Band:
        db_band = models.Band(**band.model_dump())
        self.db.add(db_band)
        self.db.commit()
        self.db.refresh(db_band)
        return db_band

    def get_by_id(self, band_id: int) -> Optional[models.Band]:
        return self.db.query(models.Band).filter(models.Band.id == band_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[models.Band]:
        return self.db.query(models.Band).offset(skip).limit(limit).all()


class BookingRequestRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, booking: schemas.BookingRequestCreate) -> models.BookingRequest:
        db_booking = models.BookingRequest(
            band_id=booking.band_id,
            title=booking.title,
            purpose=booking.purpose,
            preferred_date=booking.preferred_date,
            start_time=booking.start_time,
            end_time=booking.end_time,
            duration_hours=self._calculate_duration(booking.start_time, booking.end_time),
            participant_count=booking.participant_count,
            priority=booking.priority,
            submitted_by=booking.submitted_by
        )
        self.db.add(db_booking)
        self.db.flush()
        for eq in booking.equipment:
            db_booking_eq = models.BookingEquipment(
                booking_id=db_booking.id,
                equipment_id=eq.equipment_id,
                quantity=eq.quantity,
                source_note=eq.source_note
            )
            self.db.add(db_booking_eq)
        self.db.commit()
        self.db.refresh(db_booking)
        return db_booking

    def _calculate_duration(self, start_time: str, end_time: str) -> float:
        start_h, start_m = map(int, start_time.split(':'))
        end_h, end_m = map(int, end_time.split(':'))
        return (end_h * 60 + end_m - start_h * 60 - start_m) / 60

    def get_by_id(self, booking_id: int) -> Optional[models.BookingRequest]:
        return self.db.query(models.BookingRequest).filter(models.BookingRequest.id == booking_id).first()

    def get_all(self, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[models.BookingRequest]:
        query = self.db.query(models.BookingRequest)
        if status:
            query = query.filter(models.BookingRequest.status == status)
        return query.order_by(models.BookingRequest.submitted_at.desc()).offset(skip).limit(limit).all()

    def get_pending(self) -> List[models.BookingRequest]:
        return self.db.query(models.BookingRequest).filter(
            models.BookingRequest.status == models.BookingStatus.PENDING.value
        ).all()

    def update_status(self, booking_id: int, status: str, review_notes: Optional[str] = None,
                     reviewed_by: Optional[str] = None) -> Optional[models.BookingRequest]:
        booking = self.get_by_id(booking_id)
        if booking:
            booking.status = status
            booking.review_notes = review_notes
            booking.reviewed_by = reviewed_by
            booking.reviewed_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(booking)
        return booking

    def update_batch_id(self, booking_id: int, batch_id: str) -> None:
        booking = self.get_by_id(booking_id)
        if booking:
            booking.batch_id = batch_id
            self.db.commit()


class ScheduleRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, schedule: schemas.ScheduleCreate) -> models.Schedule:
        db_schedule = models.Schedule(**schedule.model_dump())
        self.db.add(db_schedule)
        self.db.commit()
        self.db.refresh(db_schedule)
        return db_schedule

    def get_by_id(self, schedule_id: int) -> Optional[models.Schedule]:
        return self.db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()

    def get_by_batch(self, batch_id: str) -> List[models.Schedule]:
        return self.db.query(models.Schedule).filter(models.Schedule.batch_id == batch_id).all()

    def get_by_booking(self, booking_id: int) -> List[models.Schedule]:
        return self.db.query(models.Schedule).filter(models.Schedule.booking_id == booking_id).all()

    def get_by_room_date(self, room_id: int, date_val: date) -> List[models.Schedule]:
        return self.db.query(models.Schedule).filter(
            and_(
                models.Schedule.room_id == room_id,
                models.Schedule.scheduled_date == date_val
            )
        ).all()

    def mark_final(self, schedule_id: int) -> Optional[models.Schedule]:
        schedule = self.get_by_id(schedule_id)
        if schedule:
            schedule.is_final = True
            self.db.commit()
            self.db.refresh(schedule)
        return schedule


class ConflictRecordRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, conflict: schemas.ConflictRecordCreate) -> models.ConflictRecord:
        db_conflict = models.ConflictRecord(**conflict.model_dump())
        self.db.add(db_conflict)
        self.db.commit()
        self.db.refresh(db_conflict)
        return db_conflict

    def get_by_id(self, conflict_id: int) -> Optional[models.ConflictRecord]:
        return self.db.query(models.ConflictRecord).filter(models.ConflictRecord.id == conflict_id).first()

    def get_by_batch(self, batch_id: str) -> List[models.ConflictRecord]:
        return self.db.query(models.ConflictRecord).filter(models.ConflictRecord.batch_id == batch_id).all()

    def get_by_booking(self, booking_id: int) -> List[models.ConflictRecord]:
        return self.db.query(models.ConflictRecord).filter(models.ConflictRecord.booking_id == booking_id).all()

    def resolve(self, conflict_id: int, resolution_note: str) -> Optional[models.ConflictRecord]:
        conflict = self.get_by_id(conflict_id)
        if conflict:
            conflict.resolved = True
            conflict.resolution_note = resolution_note
            self.db.commit()
            self.db.refresh(conflict)
        return conflict


class ExamWeekRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, exam_week: schemas.ExamWeekCreate) -> models.ExamWeek:
        db_exam_week = models.ExamWeek(**exam_week.model_dump())
        self.db.add(db_exam_week)
        self.db.commit()
        self.db.refresh(db_exam_week)
        return db_exam_week

    def get_by_id(self, exam_week_id: int) -> Optional[models.ExamWeek]:
        return self.db.query(models.ExamWeek).filter(models.ExamWeek.id == exam_week_id).first()

    def get_active(self) -> List[models.ExamWeek]:
        return self.db.query(models.ExamWeek).filter(models.ExamWeek.is_active == True).all()

    def is_exam_week(self, date_val: date) -> bool:
        exam_weeks = self.get_active()
        for ew in exam_weeks:
            if ew.start_date <= date_val <= ew.end_date:
                return True
        return False


class BatchReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def generate_batch_id(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        return f"BATCH_{timestamp}_{unique_id}"

    def create(self, report: schemas.BatchReportCreate, batch_id: str,
                 total_requests: int, scheduled_count: int,
                 conflict_count: int, rejected_count: int,
                 algorithm_summary: Dict[str, Any],
                 file_path: Optional[str] = None) -> models.BatchReport:
        db_report = models.BatchReport(
            batch_id=batch_id,
            batch_name=report.batch_name,
            scheduled_date=report.scheduled_date,
            total_requests=total_requests,
            scheduled_count=scheduled_count,
            conflict_count=conflict_count,
            rejected_count=rejected_count,
            algorithm_summary=algorithm_summary,
            file_path=file_path,
            created_by=report.created_by
        )
        self.db.add(db_report)
        self.db.commit()
        self.db.refresh(db_report)
        return db_report

    def get_by_id(self, report_id: int) -> Optional[models.BatchReport]:
        return self.db.query(models.BatchReport).filter(models.BatchReport.id == report_id).first()

    def get_by_batch_id(self, batch_id: str) -> Optional[models.BatchReport]:
        return self.db.query(models.BatchReport).filter(models.BatchReport.batch_id == batch_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[models.BatchReport]:
        return self.db.query(models.BatchReport).order_by(models.BatchReport.created_at.desc()).offset(skip).limit(limit).all()
