from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import List, Optional
from .models import (
    Visitor, Meeting, ParkingSpot, ParkingReservation, ReservationExtension,
    VisitorStatus, ReservationStatus
)
from .schemas import (
    VisitorCreate, MeetingCreate, MeetingApprove,
    ParkingReservationCreate, ReservationExtensionCreate
)


class BusinessError(Exception):
    def __init__(self, message: str, code: str, details: dict = None):
        self.message = message
        self.code = code
        self.details = details or {}


def create_visitor(db: Session, data: VisitorCreate) -> Visitor:
    existing = db.query(Visitor).filter(
        Visitor.license_plate == data.license_plate
    ).first()
    if existing:
        raise BusinessError(
            "该车牌号已存在访客记录",
            code="DUPLICATE_LICENSE_PLATE",
            details={"license_plate": data.license_plate, "existing_id": existing.id}
        )
    visitor = Visitor(**data.model_dump())
    db.add(visitor)
    db.commit()
    db.refresh(visitor)
    return visitor


def get_visitor(db: Session, visitor_id: int) -> Optional[Visitor]:
    return db.query(Visitor).filter(Visitor.id == visitor_id).first()


def create_meeting(db: Session, data: MeetingCreate) -> Meeting:
    visitor = get_visitor(db, data.visitor_id)
    if not visitor:
        raise BusinessError(
            "访客不存在",
            code="VISITOR_NOT_FOUND",
            details={"visitor_id": data.visitor_id}
        )
    if data.scheduled_start < datetime.now():
        raise BusinessError(
            "会议开始时间不能早于当前时间",
            code="INVALID_MEETING_TIME",
            details={"scheduled_start": data.scheduled_start.isoformat()}
        )
    existing = db.query(Meeting).filter(
        Meeting.visitor_id == data.visitor_id,
        Meeting.status.in_([VisitorStatus.PENDING, VisitorStatus.APPROVED]),
        Meeting.scheduled_end > datetime.now()
    ).first()
    if existing:
        raise BusinessError(
            "该访客已有未完成的会议",
            code="ACTIVE_MEETING_EXISTS",
            details={"existing_meeting_id": existing.id}
        )
    meeting = Meeting(**data.model_dump())
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def get_meeting(db: Session, meeting_id: int) -> Optional[Meeting]:
    return db.query(Meeting).filter(Meeting.id == meeting_id).first()


def approve_meeting(db: Session, meeting_id: int, data: MeetingApprove) -> Meeting:
    meeting = get_meeting(db, meeting_id)
    if not meeting:
        raise BusinessError(
            "会议不存在",
            code="MEETING_NOT_FOUND",
            details={"meeting_id": meeting_id}
        )
    if meeting.status != VisitorStatus.PENDING:
        raise BusinessError(
            f"会议状态不允许审批，当前状态: {meeting.status.value}",
            code="INVALID_STATUS_TRANSITION",
            details={"current_status": meeting.status.value}
        )
    meeting.status = VisitorStatus.APPROVED if data.approve else VisitorStatus.REJECTED
    meeting.approval_note = data.note
    db.commit()
    db.refresh(meeting)
    return meeting


def get_available_spots(db: Session, start: datetime, end: datetime) -> List[ParkingSpot]:
    occupied = db.query(ParkingReservation.spot_id).filter(
        ParkingReservation.status.in_([
            ReservationStatus.LOCKED,
            ReservationStatus.CONFIRMED,
            ReservationStatus.IN_USE,
            ReservationStatus.EXTENDED
        ]),
        ParkingReservation.scheduled_start < end,
        ParkingReservation.scheduled_end > start
    ).subquery()
    return db.query(ParkingSpot).filter(
        ParkingSpot.is_visitor_spot == True,
        ParkingSpot.is_active == True,
        ParkingSpot.id.notin_(occupied)
    ).all()


def find_conflicts(db: Session, spot_id: int, start: datetime, end: datetime, exclude_reservation_id: int = None):
    query = db.query(ParkingReservation).filter(
        ParkingReservation.spot_id == spot_id,
        ParkingReservation.status.in_([
            ReservationStatus.LOCKED,
            ReservationStatus.CONFIRMED,
            ReservationStatus.IN_USE,
            ReservationStatus.EXTENDED
        ]),
        ParkingReservation.scheduled_start < end,
        ParkingReservation.scheduled_end > start
    )
    if exclude_reservation_id:
        query = query.filter(ParkingReservation.id != exclude_reservation_id)
    return query.all()


def _validate_source_record(db: Session, source_record: str):
    if not source_record or not source_record.strip():
        raise BusinessError(
            "来源记录不能为空",
            code="MISSING_SOURCE_RECORD",
            details={}
        )


def create_reservation(db: Session, data: ParkingReservationCreate) -> ParkingReservation:
    meeting = get_meeting(db, data.meeting_id)
    if not meeting:
        raise BusinessError(
            "会议不存在",
            code="MEETING_NOT_FOUND",
            details={"meeting_id": data.meeting_id}
        )
    if meeting.status != VisitorStatus.APPROVED:
        raise BusinessError(
            f"会议尚未审批通过，当前状态: {meeting.status.value}",
            code="MEETING_NOT_APPROVED",
            details={"meeting_status": meeting.status.value}
        )
    _validate_source_record(db, data.source_record)
    existing = db.query(ParkingReservation).filter(
        ParkingReservation.meeting_id == meeting.id,
        ParkingReservation.status.in_([
            ReservationStatus.PENDING,
            ReservationStatus.LOCKED,
            ReservationStatus.CONFIRMED
        ])
    ).first()
    if existing:
        raise BusinessError(
            "该会议已有有效的车位预约",
            code="DUPLICATE_RESERVATION",
            details={"existing_reservation_id": existing.id}
        )
    available_spots = get_available_spots(db, meeting.scheduled_start, meeting.scheduled_end)
    if not available_spots:
        raise BusinessError(
            "该时段没有可用车位",
            code="NO_AVAILABLE_SPOTS",
            details={
                "start": meeting.scheduled_start.isoformat(),
                "end": meeting.scheduled_end.isoformat()
            }
        )
    visitor = db.query(Visitor).filter(Visitor.id == meeting.visitor_id).first()
    spot = available_spots[0]
    reservation = ParkingReservation(
        meeting_id=meeting.id,
        spot_id=spot.id,
        license_plate=visitor.license_plate,
        scheduled_start=meeting.scheduled_start,
        scheduled_end=meeting.scheduled_end,
        status=ReservationStatus.LOCKED,
        lock_expires_at=datetime.now() + timedelta(minutes=30),
        source_record=data.source_record
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return reservation


def confirm_reservation(db: Session, reservation_id: int) -> ParkingReservation:
    reservation = db.query(ParkingReservation).filter(
        ParkingReservation.id == reservation_id
    ).first()
    if not reservation:
        raise BusinessError(
            "预约记录不存在",
            code="RESERVATION_NOT_FOUND",
            details={"reservation_id": reservation_id}
        )
    if reservation.status != ReservationStatus.LOCKED:
        raise BusinessError(
            f"预约状态不允许确认，当前状态: {reservation.status.value}",
            code="INVALID_STATUS_TRANSITION",
            details={"current_status": reservation.status.value}
        )
    if reservation.lock_expires_at and datetime.now() > reservation.lock_expires_at:
        reservation.status = ReservationStatus.EXPIRED
        db.commit()
        db.refresh(reservation)
        raise BusinessError(
            "车位锁定已过期",
            code="LOCK_EXPIRED",
            details={"lock_expires_at": reservation.lock_expires_at.isoformat()}
        )
    reservation.status = ReservationStatus.CONFIRMED
    reservation.lock_expires_at = None
    db.commit()
    db.refresh(reservation)
    return reservation


def check_in_reservation(db: Session, reservation_id: int) -> ParkingReservation:
    reservation = db.query(ParkingReservation).filter(
        ParkingReservation.id == reservation_id
    ).first()
    if not reservation:
        raise BusinessError(
            "预约记录不存在",
            code="RESERVATION_NOT_FOUND",
            details={"reservation_id": reservation_id}
        )
    if reservation.status not in [ReservationStatus.CONFIRMED, ReservationStatus.EXTENDED]:
        raise BusinessError(
            f"预约状态不允许入场，当前状态: {reservation.status.value}",
            code="INVALID_STATUS_TRANSITION",
            details={"current_status": reservation.status.value}
        )
    reservation.status = ReservationStatus.IN_USE
    reservation.actual_start = datetime.now()
    db.commit()
    db.refresh(reservation)
    return reservation


def check_out_reservation(db: Session, reservation_id: int) -> ParkingReservation:
    reservation = db.query(ParkingReservation).filter(
        ParkingReservation.id == reservation_id
    ).first()
    if not reservation:
        raise BusinessError(
            "预约记录不存在",
            code="RESERVATION_NOT_FOUND",
            details={"reservation_id": reservation_id}
        )
    if reservation.status not in [ReservationStatus.IN_USE, ReservationStatus.EXTENDED]:
        raise BusinessError(
            f"预约状态不允许离场，当前状态: {reservation.status.value}",
            code="INVALID_STATUS_TRANSITION",
            details={"current_status": reservation.status.value}
        )
    reservation.status = ReservationStatus.COMPLETED
    reservation.actual_end = datetime.now()
    db.commit()
    db.refresh(reservation)
    return reservation


def extend_reservation(db: Session, data: ReservationExtensionCreate) -> ParkingReservation:
    reservation = db.query(ParkingReservation).filter(
        ParkingReservation.id == data.reservation_id
    ).first()
    if not reservation:
        raise BusinessError(
            "预约记录不存在",
            code="RESERVATION_NOT_FOUND",
            details={"reservation_id": data.reservation_id}
        )
    if reservation.status not in [ReservationStatus.CONFIRMED, ReservationStatus.IN_USE, ReservationStatus.EXTENDED]:
        raise BusinessError(
            f"预约状态不允许延时，当前状态: {reservation.status.value}",
            code="INVALID_STATUS_TRANSITION",
            details={"current_status": reservation.status.value}
        )
    original_end = reservation.scheduled_end
    new_end = original_end + timedelta(minutes=data.minutes)
    conflicts = find_conflicts(
        db,
        reservation.spot_id,
        original_end,
        new_end,
        exclude_reservation_id=reservation.id
    )
    if conflicts:
        conflict_details = []
        for c in conflicts:
            conflict_details.append({
                "reservation_id": c.id,
                "conflict_start": c.scheduled_start.isoformat(),
                "conflict_end": c.scheduled_end.isoformat()
            })
        raise BusinessError(
            "该时段已有其他预约，无法延时",
            code="EXTENSION_CONFLICT",
            details={
                "requested_end": new_end.isoformat(),
                "conflicts": conflict_details
            }
        )
    extension = ReservationExtension(
        reservation_id=reservation.id,
        original_end=original_end,
        new_end=new_end,
        reason=data.reason,
        status=ReservationStatus.CONFIRMED
    )
    db.add(extension)
    reservation.scheduled_end = new_end
    if reservation.status != ReservationStatus.IN_USE:
        reservation.status = ReservationStatus.EXTENDED
    db.commit()
    db.refresh(reservation)
    return reservation


def cancel_reservation(db: Session, reservation_id: int) -> ParkingReservation:
    reservation = db.query(ParkingReservation).filter(
        ParkingReservation.id == reservation_id
    ).first()
    if not reservation:
        raise BusinessError(
            "预约记录不存在",
            code="RESERVATION_NOT_FOUND",
            details={"reservation_id": reservation_id}
        )
    if reservation.status in [ReservationStatus.COMPLETED, ReservationStatus.CANCELLED, ReservationStatus.EXPIRED]:
        raise BusinessError(
            f"预约状态不允许取消，当前状态: {reservation.status.value}",
            code="INVALID_STATUS_TRANSITION",
            details={"current_status": reservation.status.value}
        )
    reservation.status = ReservationStatus.CANCELLED
    db.commit()
    db.refresh(reservation)
    return reservation


def get_reservation(db: Session, reservation_id: int) -> Optional[ParkingReservation]:
    return db.query(ParkingReservation).filter(
        ParkingReservation.id == reservation_id
    ).first()


def get_reservations_by_meeting(db: Session, meeting_id: int) -> List[ParkingReservation]:
    return db.query(ParkingReservation).filter(
        ParkingReservation.meeting_id == meeting_id
    ).order_by(ParkingReservation.created_at.desc()).all()


def get_meeting_with_reservations(db: Session, meeting_id: int):
    meeting = get_meeting(db, meeting_id)
    if not meeting:
        return None
    reservations = get_reservations_by_meeting(db, meeting_id)
    return {"meeting": meeting, "reservations": reservations}
