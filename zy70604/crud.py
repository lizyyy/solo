from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
import models
import schemas
import json


def json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def log_operation(db: Session, operation_type: str, target_type: str = None,
                  target_id: int = None, original_input: dict = None,
                  handler: str = None, conclusion: str = None,
                  notes: str = None, success: bool = True):
    log = models.OperationLog(
        operation_type=operation_type,
        target_type=target_type,
        target_id=target_id,
        original_input=json.dumps(original_input, ensure_ascii=False, default=json_serializer) if original_input else None,
        handler=handler,
        conclusion=conclusion,
        notes=notes,
        success=success
    )
    db.add(log)
    db.commit()
    return log


def create_coach(db: Session, coach: schemas.CoachCreate):
    db_coach = models.Coach(**coach.dict())
    db.add(db_coach)
    db.commit()
    db.refresh(db_coach)
    return db_coach


def get_coach(db: Session, coach_id: int):
    return db.query(models.Coach).filter(models.Coach.id == coach_id).first()


def get_coaches(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Coach).offset(skip).limit(limit).all()


def create_member_card(db: Session, card: schemas.MemberCardCreate):
    db_card = models.MemberCard(
        **card.dict(),
        remaining_hours=card.total_hours
    )
    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    return db_card


def get_member_card(db: Session, card_id: int):
    return db.query(models.MemberCard).filter(models.MemberCard.id == card_id).first()


def get_member_cards(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.MemberCard).offset(skip).limit(limit).all()


def create_course_package(db: Session, package: schemas.CoursePackageCreate):
    db_package = models.CoursePackage(
        **package.dict(),
        remaining_hours=package.total_hours
    )
    db.add(db_package)
    db.commit()
    db.refresh(db_package)
    return db_package


def get_course_package(db: Session, package_id: int):
    return db.query(models.CoursePackage).filter(models.CoursePackage.id == package_id).first()


def get_course_packages(db: Session, member_card_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.CoursePackage)
    if member_card_id:
        query = query.filter(models.CoursePackage.member_card_id == member_card_id)
    return query.offset(skip).limit(limit).all()


def check_time_conflict(db: Session, coach_id: int, booking_date: datetime,
                        start_time: str, end_time: str, exclude_booking_id: int = None):
    query = db.query(models.Booking).filter(
        models.Booking.main_coach_id == coach_id,
        models.Booking.booking_date == booking_date,
        models.Booking.status.notin_(["cancelled", "consumed"])
    )
    if exclude_booking_id:
        query = query.filter(models.Booking.id != exclude_booking_id)
    
    bookings = query.all()
    
    for booking in bookings:
        if not (end_time <= booking.start_time or start_time >= booking.end_time):
            return True
    return False


def can_cancel_booking(booking: models.Booking):
    now = datetime.now()
    booking_datetime = datetime.combine(
        booking.booking_date.date(),
        datetime.strptime(booking.start_time, "%H:%M").time()
    )
    hours_until_booking = (booking_datetime - now).total_seconds() / 3600
    return hours_until_booking >= 24


def create_booking(db: Session, booking: schemas.BookingCreate):
    member_card = get_member_card(db, booking.member_card_id)
    if not member_card:
        raise ValueError("会员卡不存在")
    
    course_package = get_course_package(db, booking.course_package_id)
    if not course_package:
        raise ValueError("课程包不存在")
    
    if course_package.member_card_id != booking.member_card_id:
        raise ValueError("课程包不属于该会员")
    
    if course_package.remaining_hours < booking.hours:
        raise ValueError("课程包剩余课时不足")
    
    if check_time_conflict(db, booking.main_coach_id, booking.booking_date,
                          booking.start_time, booking.end_time):
        raise ValueError("该教练此时间段已有预约")
    
    db_booking = models.Booking(
        **booking.dict(),
        status=models.BookingStatus.PENDING
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    
    log_operation(db, "create_booking", "booking", db_booking.id,
                  booking.dict(), booking.created_by, "success")
    
    return db_booking


def get_booking(db: Session, booking_id: int):
    return db.query(models.Booking).filter(models.Booking.id == booking_id).first()


def get_bookings(db: Session, member_card_id: int = None, coach_id: int = None,
                 status: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Booking)
    if member_card_id:
        query = query.filter(models.Booking.member_card_id == member_card_id)
    if coach_id:
        query = query.filter(models.Booking.main_coach_id == coach_id)
    if status:
        query = query.filter(models.Booking.status == status)
    return query.order_by(models.Booking.booking_date.desc()).offset(skip).limit(limit).all()


def confirm_booking(db: Session, booking_id: int, handler: str):
    booking = get_booking(db, booking_id)
    if not booking:
        raise ValueError("预约不存在")
    
    if booking.status != models.BookingStatus.PENDING:
        raise ValueError("当前状态不能确认")
    
    booking.status = models.BookingStatus.CONFIRMED
    db.commit()
    db.refresh(booking)
    
    log_operation(db, "confirm_booking", "booking", booking_id,
                  {"booking_id": booking_id}, handler, "success")
    
    return booking


def consume_booking(db: Session, booking_id: int, consumed_by: str, notes: str = None):
    booking = get_booking(db, booking_id)
    if not booking:
        raise ValueError("预约不存在")
    
    if booking.status not in [models.BookingStatus.CONFIRMED, models.BookingStatus.SUBSTITUTE_CONFIRMED]:
        raise ValueError("当前状态不能消课")
    
    existing_consumption = db.query(models.ConsumptionRecord).filter(
        models.ConsumptionRecord.booking_id == booking_id,
        models.ConsumptionRecord.is_rollback == False
    ).first()
    
    if existing_consumption:
        raise ValueError("该预约已消课，不可重复消课")
    
    course_package = booking.course_package
    member_card = booking.member_card
    
    if course_package.remaining_hours < booking.hours:
        raise ValueError("课程包剩余课时不足")
    
    coach_id = booking.main_coach_id
    substitute = db.query(models.SubstituteRecord).filter(
        models.SubstituteRecord.booking_id == booking_id,
        models.SubstituteRecord.status == models.SubstituteStatus.CONFIRMED
    ).first()
    if substitute:
        coach_id = substitute.substitute_coach_id
    
    consumption = models.ConsumptionRecord(
        booking_id=booking_id,
        member_card_id=booking.member_card_id,
        course_package_id=booking.course_package_id,
        coach_id=coach_id,
        hours=booking.hours,
        consumed_by=consumed_by,
        notes=notes
    )
    db.add(consumption)
    
    course_package.used_hours += booking.hours
    course_package.remaining_hours -= booking.hours
    
    member_card.used_hours += booking.hours
    member_card.remaining_hours -= booking.hours
    
    booking.status = models.BookingStatus.CONSUMED
    booking.consumed_at = datetime.now()
    booking.consumed_by = consumed_by
    
    db.commit()
    db.refresh(booking)
    
    log_operation(db, "consume_booking", "booking", booking_id,
                  {"booking_id": booking_id, "hours": booking.hours},
                  consumed_by, "success", notes)
    
    return booking


def cancel_booking(db: Session, booking_id: int, handler: str, reason: str = None):
    booking = get_booking(db, booking_id)
    if not booking:
        raise ValueError("预约不存在")
    
    if booking.status in [models.BookingStatus.CONSUMED, models.BookingStatus.CANCELLED]:
        raise ValueError("当前状态不能取消")
    
    if not can_cancel_booking(booking):
        raise ValueError("距离上课不足24小时，不能取消")
    
    booking.status = models.BookingStatus.CANCELLED
    db.commit()
    db.refresh(booking)
    
    log_operation(db, "cancel_booking", "booking", booking_id,
                  {"booking_id": booking_id, "reason": reason},
                  handler, "success")
    
    return booking


def apply_leave(db: Session, leave: schemas.LeaveApplicationCreate, handler: str):
    booking = get_booking(db, leave.booking_id)
    if not booking:
        raise ValueError("预约不存在")
    
    if booking.status in [models.BookingStatus.CONSUMED, models.BookingStatus.CANCELLED,
                           models.BookingStatus.LEAVE_APPLIED, models.BookingStatus.LEAVE_APPROVED]:
        raise ValueError("当前状态不能申请请假")
    
    db_leave = models.LeaveApplication(**leave.dict())
    db.add(db_leave)
    
    booking.status = models.BookingStatus.LEAVE_APPLIED
    db.commit()
    db.refresh(db_leave)
    db.refresh(booking)
    
    log_operation(db, "apply_leave", "leave", db_leave.id,
                  leave.dict(), handler, "success")
    
    return db_leave


def get_leave_application(db: Session, leave_id: int):
    return db.query(models.LeaveApplication).filter(models.LeaveApplication.id == leave_id).first()


def approve_leave(db: Session, leave_id: int, handler: str):
    leave = get_leave_application(db, leave_id)
    if not leave:
        raise ValueError("请假申请不存在")
    
    if leave.status != models.LeaveStatus.PENDING:
        raise ValueError("当前状态不能审批")
    
    leave.status = models.LeaveStatus.APPROVED
    leave.approved_at = datetime.now()
    leave.approved_by = handler
    
    booking = leave.booking
    booking.status = models.BookingStatus.LEAVE_APPROVED
    
    if leave.freeze_hours:
        course_package = booking.course_package
        member_card = booking.member_card
        
        course_package.frozen_hours += booking.hours
        member_card.frozen_hours += booking.hours
    
    db.commit()
    db.refresh(leave)
    
    log_operation(db, "approve_leave", "leave", leave_id,
                  {"leave_id": leave_id}, handler, "success")
    
    return leave


def reject_leave(db: Session, leave_id: int, handler: str, rejection_reason: str):
    leave = get_leave_application(db, leave_id)
    if not leave:
        raise ValueError("请假申请不存在")
    
    if leave.status != models.LeaveStatus.PENDING:
        raise ValueError("当前状态不能审批")
    
    leave.status = models.LeaveStatus.REJECTED
    leave.approved_by = handler
    leave.rejection_reason = rejection_reason
    
    booking = leave.booking
    booking.status = models.BookingStatus.CONFIRMED
    
    db.commit()
    db.refresh(leave)
    
    log_operation(db, "reject_leave", "leave", leave_id,
                  {"leave_id": leave_id, "rejection_reason": rejection_reason},
                  handler, "success")
    
    return leave


def request_substitute(db: Session, substitute: schemas.SubstituteRecordCreate, handler: str):
    booking = get_booking(db, substitute.booking_id)
    if not booking:
        raise ValueError("预约不存在")
    
    if booking.status in [models.BookingStatus.CONSUMED, models.BookingStatus.CANCELLED]:
        raise ValueError("当前状态不能申请代课")
    
    substitute_coach = get_coach(db, substitute.substitute_coach_id)
    if not substitute_coach:
        raise ValueError("代课教练不存在")
    
    if substitute.substitute_coach_id == booking.main_coach_id:
        raise ValueError("代课教练不能与原教练相同")
    
    if check_time_conflict(db, substitute.substitute_coach_id, booking.booking_date,
                          booking.start_time, booking.end_time):
        raise ValueError("代课教练此时间段已有预约")
    
    db_substitute = models.SubstituteRecord(
        **substitute.dict(),
        original_coach_id=booking.main_coach_id,
        status=models.SubstituteStatus.PENDING
    )
    db.add(db_substitute)
    
    booking.status = models.BookingStatus.SUBSTITUTE_REQUESTED
    db.commit()
    db.refresh(db_substitute)
    db.refresh(booking)
    
    log_operation(db, "request_substitute", "substitute", db_substitute.id,
                  substitute.dict(), handler, "success")
    
    return db_substitute


def get_substitute_record(db: Session, substitute_id: int):
    return db.query(models.SubstituteRecord).filter(models.SubstituteRecord.id == substitute_id).first()


def confirm_substitute(db: Session, substitute_id: int, handler: str):
    substitute = get_substitute_record(db, substitute_id)
    if not substitute:
        raise ValueError("代课记录不存在")
    
    if substitute.status != models.SubstituteStatus.PENDING:
        raise ValueError("当前状态不能确认")
    
    substitute.status = models.SubstituteStatus.CONFIRMED
    substitute.confirmed_at = datetime.now()
    substitute.confirmed_by = handler
    
    booking = substitute.booking
    booking.status = models.BookingStatus.SUBSTITUTE_CONFIRMED
    
    db.commit()
    db.refresh(substitute)
    
    log_operation(db, "confirm_substitute", "substitute", substitute_id,
                  {"substitute_id": substitute_id}, handler, "success")
    
    return substitute


def reject_substitute(db: Session, substitute_id: int, handler: str, rejection_reason: str):
    substitute = get_substitute_record(db, substitute_id)
    if not substitute:
        raise ValueError("代课记录不存在")
    
    if substitute.status != models.SubstituteStatus.PENDING:
        raise ValueError("当前状态不能拒绝")
    
    substitute.status = models.SubstituteStatus.REJECTED
    substitute.confirmed_by = handler
    substitute.rejection_reason = rejection_reason
    
    booking = substitute.booking
    booking.status = models.BookingStatus.CONFIRMED
    
    db.commit()
    db.refresh(substitute)
    
    log_operation(db, "reject_substitute", "substitute", substitute_id,
                  {"substitute_id": substitute_id, "rejection_reason": rejection_reason},
                  handler, "success")
    
    return substitute


def schedule_makeup(db: Session, original_booking_id: int, new_booking: schemas.BookingCreate):
    original_booking = get_booking(db, original_booking_id)
    if not original_booking:
        raise ValueError("原预约不存在")
    
    if original_booking.status != models.BookingStatus.LEAVE_APPROVED:
        raise ValueError("只有已批准的请假可以安排补课")
    
    booking_data = new_booking.dict()
    booking_data["is_makeup"] = True
    booking_data["makeup_for_booking_id"] = original_booking_id
    
    member_card = get_member_card(db, new_booking.member_card_id)
    course_package = get_course_package(db, new_booking.course_package_id)
    
    if course_package.member_card_id != new_booking.member_card_id:
        raise ValueError("课程包不属于该会员")
    
    if course_package.remaining_hours < new_booking.hours:
        raise ValueError("课程包剩余课时不足")
    
    if check_time_conflict(db, new_booking.main_coach_id, new_booking.booking_date,
                          new_booking.start_time, new_booking.end_time):
        raise ValueError("该教练此时间段已有预约")
    
    db_new_booking = models.Booking(
        **booking_data,
        status=models.BookingStatus.PENDING
    )
    db.add(db_new_booking)
    db.commit()
    db.refresh(db_new_booking)
    
    course_package = original_booking.course_package
    member_card = original_booking.member_card
    
    if original_booking.leave_application.freeze_hours:
        course_package.frozen_hours -= original_booking.hours
        member_card.frozen_hours -= original_booking.hours
    
    db_new_booking.status = models.BookingStatus.MAKEUP_SCHEDULED
    db.commit()
    db.refresh(db_new_booking)
    
    log_operation(db, "schedule_makeup", "booking", db_new_booking.id,
                  {"original_booking_id": original_booking_id, "new_booking": new_booking.dict()},
                  new_booking.created_by, "success")
    
    return db_new_booking


def rollback_consumption(db: Session, consumption_id: int, reason: str, handler: str):
    consumption = db.query(models.ConsumptionRecord).filter(
        models.ConsumptionRecord.id == consumption_id
    ).first()
    
    if not consumption:
        raise ValueError("消课记录不存在")
    
    if consumption.is_rollback:
        raise ValueError("该消课记录已撤回")
    
    consumption.is_rollback = True
    consumption.rollback_reason = reason
    consumption.rollback_by = handler
    consumption.rollback_at = datetime.now()
    
    course_package = db.query(models.CoursePackage).filter(
        models.CoursePackage.id == consumption.course_package_id
    ).first()
    
    member_card = db.query(models.MemberCard).filter(
        models.MemberCard.id == consumption.member_card_id
    ).first()
    
    booking = consumption.booking
    
    course_package.used_hours -= consumption.hours
    course_package.remaining_hours += consumption.hours
    
    member_card.used_hours -= consumption.hours
    member_card.remaining_hours += consumption.hours
    
    booking.status = models.BookingStatus.CONFIRMED
    booking.consumed_at = None
    booking.consumed_by = None
    
    db.commit()
    db.refresh(consumption)
    
    log_operation(db, "rollback_consumption", "consumption", consumption_id,
                  {"consumption_id": consumption_id, "reason": reason},
                  handler, "success")
    
    return consumption


def manual_correction(db: Session, request: schemas.ManualCorrectionRequest):
    if request.target_type == "member_card":
        target = get_member_card(db, request.target_id)
        if not target:
            raise ValueError("会员卡不存在")
        
        if request.correction_type == "adjust_hours":
            delta = int(request.new_value)
            target.total_hours += delta
            target.remaining_hours += delta
        elif request.correction_type == "set_active":
            target.is_active = request.new_value.lower() == "true"
    
    elif request.target_type == "course_package":
        target = get_course_package(db, request.target_id)
        if not target:
            raise ValueError("课程包不存在")
        
        if request.correction_type == "adjust_hours":
            delta = int(request.new_value)
            target.total_hours += delta
            target.remaining_hours += delta
    
    elif request.target_type == "booking":
        target = get_booking(db, request.target_id)
        if not target:
            raise ValueError("预约不存在")
        
        if request.correction_type == "set_status":
            target.status = request.new_value
    
    else:
        raise ValueError("不支持的目标类型")
    
    db.commit()
    
    log_operation(db, "manual_correction", request.target_type, request.target_id,
                  request.dict(), request.handler, "success", request.notes)
    
    return {"success": True, "message": "人工修正成功"}


def get_consumption_records(db: Session, member_card_id: int = None, course_package_id: int = None,
                            coach_id: int = None, start_date: datetime = None, end_date: datetime = None,
                            skip: int = 0, limit: int = 100):
    query = db.query(models.ConsumptionRecord).filter(models.ConsumptionRecord.is_rollback == False)
    
    if member_card_id:
        query = query.filter(models.ConsumptionRecord.member_card_id == member_card_id)
    if course_package_id:
        query = query.filter(models.ConsumptionRecord.course_package_id == course_package_id)
    if coach_id:
        query = query.filter(models.ConsumptionRecord.coach_id == coach_id)
    if start_date:
        query = query.filter(models.ConsumptionRecord.consumed_at >= start_date)
    if end_date:
        query = query.filter(models.ConsumptionRecord.consumed_at <= end_date)
    
    return query.order_by(models.ConsumptionRecord.consumed_at.desc()).offset(skip).limit(limit).all()


def get_operation_logs(db: Session, operation_type: str = None, target_type: str = None,
                       target_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.OperationLog)
    
    if operation_type:
        query = query.filter(models.OperationLog.operation_type == operation_type)
    if target_type:
        query = query.filter(models.OperationLog.target_type == target_type)
    if target_id:
        query = query.filter(models.OperationLog.target_id == target_id)
    
    return query.order_by(models.OperationLog.created_at.desc()).offset(skip).limit(limit).all()


def generate_report(db: Session, query: schemas.ReportQuery):
    consumption_records = get_consumption_records(
        db,
        member_card_id=query.member_card_id,
        coach_id=query.coach_id,
        start_date=datetime.combine(query.start_date, datetime.min.time()) if query.start_date else None,
        end_date=datetime.combine(query.end_date, datetime.max.time()) if query.end_date else None
    )
    
    total_hours = sum(r.hours for r in consumption_records)
    
    report_data = []
    for record in consumption_records:
        report_data.append({
            "id": record.id,
            "member_name": record.booking.member_card.member_name,
            "coach_name": record.booking.main_coach.name,
            "package_name": record.booking.course_package.package_name,
            "booking_date": record.booking.booking_date,
            "consumed_at": record.consumed_at,
            "hours": record.hours,
            "consumed_by": record.consumed_by,
            "notes": record.notes
        })
    
    return {
        "total_records": len(report_data),
        "total_hours": total_hours,
        "data": report_data
    }
