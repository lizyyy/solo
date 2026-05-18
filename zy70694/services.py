from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from models import (
    PianoRoom, User, Booking, LateRecord, RenewalApplication,
    RoomStatus, BookingStatus, RenewalStatus
)
from schemas import (
    BookingCreate, RenewalApplicationCreate, UsageReportResponse, UsageReportItem
)


class BusinessError(Exception):
    def __init__(self, error_code: str, message: str, details: dict = None):
        self.error_code = error_code
        self.message = message
        self.details = details or {}
        super().__init__(message)


def calculate_duration(start_time: str, end_time: str) -> float:
    start = datetime.strptime(start_time, '%H:%M')
    end = datetime.strptime(end_time, '%H:%M')
    delta = end - start
    return delta.total_seconds() / 3600


def check_time_overlap(
    db: Session, room_id: int, booking_date: str,
    start_time: str, end_time: str, exclude_booking_id: int = None
) -> bool:
    bookings = db.query(Booking).filter(
        Booking.room_id == room_id,
        Booking.booking_date == booking_date,
        Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.RELEASED])
    )
    
    if exclude_booking_id:
        bookings = bookings.filter(Booking.id != exclude_booking_id)
    
    for booking in bookings.all():
        if not (end_time <= booking.start_time or start_time >= booking.end_time):
            return True
    return False


def check_duplicate_booking(
    db: Session, user_id: int, booking_date: str,
    start_time: str, end_time: str
) -> bool:
    existing = db.query(Booking).filter(
        Booking.user_id == user_id,
        Booking.booking_date == booking_date,
        Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.RELEASED])
    ).all()
    
    for booking in existing:
        if not (end_time <= booking.start_time or start_time >= booking.end_time):
            return True
    return False


def create_booking_service(db: Session, booking_data: BookingCreate) -> Booking:
    room = db.query(PianoRoom).filter(PianoRoom.id == booking_data.room_id).first()
    if not room:
        raise BusinessError("ROOM_NOT_FOUND", "琴房不存在")
    
    if room.status != RoomStatus.AVAILABLE:
        raise BusinessError("ROOM_NOT_AVAILABLE", "琴房当前不可预约")
    
    user = db.query(User).filter(User.id == booking_data.user_id).first()
    if not user:
        raise BusinessError("USER_NOT_FOUND", "用户不存在")
    
    duration = calculate_duration(booking_data.start_time, booking_data.end_time)
    if duration <= 0:
        raise BusinessError("INVALID_TIME_RANGE", "结束时间必须晚于开始时间")
    
    if check_time_overlap(db, booking_data.room_id, booking_data.booking_date,
                          booking_data.start_time, booking_data.end_time):
        raise BusinessError("TIME_SLOT_CONFLICT", "该时段已被预约")
    
    if check_duplicate_booking(db, booking_data.user_id, booking_data.booking_date,
                               booking_data.start_time, booking_data.end_time):
        raise BusinessError("DUPLICATE_BOOKING", "您在该时段已有其他预约")
    
    total_amount = duration * room.hourly_rate
    
    booking = Booking(
        room_id=booking_data.room_id,
        user_id=booking_data.user_id,
        booking_date=booking_data.booking_date,
        start_time=booking_data.start_time,
        end_time=booking_data.end_time,
        duration_hours=duration,
        total_amount=total_amount,
        status=BookingStatus.CONFIRMED
    )
    
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def checkin_service(db: Session, booking_id: int) -> Tuple[Booking, Optional[LateRecord]]:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise BusinessError("BOOKING_NOT_FOUND", "预约不存在")
    
    if booking.status == BookingStatus.CHECKED_IN:
        raise BusinessError("ALREADY_CHECKED_IN", "已签到，请勿重复操作")
    
    if booking.status == BookingStatus.CANCELLED:
        raise BusinessError("BOOKING_CANCELLED", "预约已取消")
    
    if booking.status == BookingStatus.RELEASED:
        raise BusinessError("BOOKING_RELEASED", "该预约因迟到已被释放")
    
    if booking.status == BookingStatus.COMPLETED:
        raise BusinessError("BOOKING_COMPLETED", "该预约已完成")
    
    now = datetime.now()
    booking_start = datetime.strptime(
        f"{booking.booking_date} {booking.start_time}",
        "%Y-%m-%d %H:%M"
    )
    
    late_minutes = 0
    late_record = None
    
    if now > booking_start:
        late_minutes = int((now - booking_start).total_seconds() / 60)
        
        if late_minutes >= 30:
            late_record = LateRecord(
                booking_id=booking.id,
                user_id=booking.user_id,
                late_minutes=late_minutes,
                is_released=True,
                released_at=now
            )
            db.add(late_record)
            booking.status = BookingStatus.RELEASED
            booking.is_late_released = True
            
            room = db.query(PianoRoom).filter(PianoRoom.id == booking.room_id).first()
            room.status = RoomStatus.AVAILABLE
            
            db.commit()
            raise BusinessError("TOO_LATE", "迟到超过30分钟，预约已失效")
        
        late_record = LateRecord(
            booking_id=booking.id,
            user_id=booking.user_id,
            late_minutes=late_minutes,
            is_released=False
        )
        db.add(late_record)
        booking.status = BookingStatus.LATE
    else:
        booking.status = BookingStatus.CHECKED_IN
    
    booking.check_in_time = now
    
    room = db.query(PianoRoom).filter(PianoRoom.id == booking.room_id).first()
    room.status = RoomStatus.OCCUPIED
    
    db.commit()
    db.refresh(booking)
    if late_record:
        db.refresh(late_record)
    
    return booking, late_record


def late_release_service(db: Session, booking_id: int, late_minutes: int) -> LateRecord:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise BusinessError("BOOKING_NOT_FOUND", "预约不存在")
    
    if booking.status == BookingStatus.RELEASED:
        raise BusinessError("ALREADY_RELEASED", "该预约已被释放")
    
    if booking.status == BookingStatus.CHECKED_IN:
        raise BusinessError("ALREADY_CHECKED_IN", "用户已签到，不能释放")
    
    if late_minutes < 30:
        raise BusinessError("INSUFFICIENT_LATE_TIME", "迟到不足30分钟，不能自动释放")
    
    late_record = LateRecord(
        booking_id=booking.id,
        user_id=booking.user_id,
        late_minutes=late_minutes,
        is_released=True,
        released_at=datetime.now()
    )
    
    booking.status = BookingStatus.RELEASED
    booking.is_late_released = True
    
    room = db.query(PianoRoom).filter(PianoRoom.id == booking.room_id).first()
    room.status = RoomStatus.AVAILABLE
    
    db.add(late_record)
    db.commit()
    db.refresh(late_record)
    
    return late_record


def checkout_service(db: Session, booking_id: int) -> Booking:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise BusinessError("BOOKING_NOT_FOUND", "预约不存在")
    
    if booking.status not in [BookingStatus.CHECKED_IN, BookingStatus.LATE]:
        raise BusinessError("INVALID_STATUS_FOR_CHECKOUT", "当前状态不能退房")
    
    if booking.check_out_time:
        raise BusinessError("ALREADY_CHECKED_OUT", "已退房，请勿重复操作")
    
    booking.check_out_time = datetime.now()
    booking.status = BookingStatus.COMPLETED
    
    room = db.query(PianoRoom).filter(PianoRoom.id == booking.room_id).first()
    room.status = RoomStatus.AVAILABLE
    
    db.commit()
    db.refresh(booking)
    return booking


def create_renewal_service(db: Session, renewal_data: RenewalApplicationCreate) -> RenewalApplication:
    booking = db.query(Booking).filter(Booking.id == renewal_data.booking_id).first()
    if not booking:
        raise BusinessError("BOOKING_NOT_FOUND", "预约不存在")
    
    if booking.status not in [BookingStatus.CHECKED_IN, BookingStatus.LATE]:
        raise BusinessError("INVALID_STATUS_FOR_RENEWAL", "当前状态不能申请续费")
    
    pending_renewal = db.query(RenewalApplication).filter(
        RenewalApplication.booking_id == renewal_data.booking_id,
        RenewalApplication.status == RenewalStatus.PENDING
    ).first()
    
    if pending_renewal:
        raise BusinessError("PENDING_RENEWAL_EXISTS", "已有待审核的续费申请")
    
    current_end = datetime.strptime(booking.end_time, '%H:%M')
    new_end = current_end + timedelta(hours=renewal_data.extend_hours)
    new_end_time = new_end.strftime('%H:%M')
    
    if check_time_overlap(db, booking.room_id, booking.booking_date,
                          booking.end_time, new_end_time, exclude_booking_id=booking.id):
        raise BusinessError("RENEWAL_TIME_CONFLICT", "续费时段与其他预约冲突")
    
    room = db.query(PianoRoom).filter(PianoRoom.id == booking.room_id).first()
    additional_amount = renewal_data.extend_hours * room.hourly_rate
    
    renewal = RenewalApplication(
        booking_id=renewal_data.booking_id,
        extend_hours=renewal_data.extend_hours,
        new_end_time=new_end_time,
        additional_amount=additional_amount,
        status=RenewalStatus.PENDING
    )
    
    db.add(renewal)
    db.commit()
    db.refresh(renewal)
    return renewal


def approve_renewal_service(db: Session, renewal_id: int, remarks: str = None) -> RenewalApplication:
    renewal = db.query(RenewalApplication).filter(RenewalApplication.id == renewal_id).first()
    if not renewal:
        raise BusinessError("RENEWAL_NOT_FOUND", "续费申请不存在")
    
    if renewal.status != RenewalStatus.PENDING:
        raise BusinessError("RENEWAL_ALREADY_PROCESSED", "该申请已处理过")
    
    booking = db.query(Booking).filter(Booking.id == renewal.booking_id).first()
    
    booking.end_time = renewal.new_end_time
    booking.duration_hours += renewal.extend_hours
    booking.total_amount += renewal.additional_amount
    
    renewal.status = RenewalStatus.APPROVED
    renewal.approved_at = datetime.now()
    renewal.remarks = remarks
    
    db.commit()
    db.refresh(renewal)
    return renewal


def reject_renewal_service(db: Session, renewal_id: int, remarks: str = None) -> RenewalApplication:
    renewal = db.query(RenewalApplication).filter(RenewalApplication.id == renewal_id).first()
    if not renewal:
        raise BusinessError("RENEWAL_NOT_FOUND", "续费申请不存在")
    
    if renewal.status != RenewalStatus.PENDING:
        raise BusinessError("RENEWAL_ALREADY_PROCESSED", "该申请已处理过")
    
    renewal.status = RenewalStatus.REJECTED
    renewal.remarks = remarks
    
    db.commit()
    db.refresh(renewal)
    return renewal


def generate_usage_report(db: Session, start_date: str, end_date: str, room_id: int = None) -> UsageReportResponse:
    query = db.query(Booking).filter(
        Booking.booking_date >= start_date,
        Booking.booking_date <= end_date
    )
    
    if room_id:
        query = query.filter(Booking.room_id == room_id)
    
    bookings = query.all()
    
    details = []
    total_revenue = 0
    late_count = 0
    renewal_count = 0
    released_count = 0
    
    for booking in bookings:
        late_record = db.query(LateRecord).filter(LateRecord.booking_id == booking.id).first()
        renewals = db.query(RenewalApplication).filter(
            RenewalApplication.booking_id == booking.id,
            RenewalApplication.status == RenewalStatus.APPROVED
        ).all()
        
        is_late = late_record is not None
        late_minutes = late_record.late_minutes if late_record else 0
        has_renewal = len(renewals) > 0
        renewal_hours = sum(r.extend_hours for r in renewals)
        
        if is_late:
            late_count += 1
        if has_renewal:
            renewal_count += 1
        if booking.status == BookingStatus.RELEASED:
            released_count += 1
        
        total_revenue += booking.total_amount
        
        item = UsageReportItem(
            booking_id=booking.id,
            room_name=booking.room.name,
            user_name=booking.user.name,
            booking_date=booking.booking_date,
            start_time=booking.start_time,
            end_time=booking.end_time,
            actual_start=booking.check_in_time.strftime('%H:%M') if booking.check_in_time else None,
            actual_end=booking.check_out_time.strftime('%H:%M') if booking.check_out_time else None,
            duration=booking.duration_hours,
            total_amount=booking.total_amount,
            status=booking.status,
            is_late=is_late,
            late_minutes=late_minutes,
            has_renewal=has_renewal,
            renewal_hours=renewal_hours
        )
        details.append(item)
    
    return UsageReportResponse(
        report_period=f"{start_date} 至 {end_date}",
        total_bookings=len(bookings),
        total_revenue=total_revenue,
        late_checkins_count=late_count,
        renewal_count=renewal_count,
        released_bookings_count=released_count,
        details=details
    )
