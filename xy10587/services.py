from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from models import (
    Member, Coach, Package, Appointment, Leave, NoShow, Transfer,
    Deduction, Commission, StatusHistory, ManualCorrection, IdempotencyLog,
    MemberStatus, CoachStatus, PackageStatus, AppointmentStatus, DeductionReason
)
import json

CUTOFF_HOURS_BEFORE = 24

def add_status_history(db: Session, entity_type: str, entity_id: int, 
                       from_status: str, to_status: str, action: str, 
                       request_id: str = None, operator: str = None, 
                       reason: str = None):
    history = StatusHistory(
        entity_type=entity_type,
        entity_id=entity_id,
        from_status=from_status,
        to_status=to_status,
        action=action,
        request_id=request_id,
        operator=operator,
        reason=reason
    )
    db.add(history)
    db.flush()
    return history

def check_idempotency(db: Session, request_id: str, action: str, entity_type: str):
    log = db.query(IdempotencyLog).filter(
        IdempotencyLog.request_id == request_id
    ).first()
    if log:
        return True, log
    return False, None

def create_idempotency_log(db: Session, request_id: str, action: str, 
                           entity_type: str, entity_id: int = None, 
                           status: str = "success", response_data: dict = None,
                           error_message: str = None):
    log = IdempotencyLog(
        request_id=request_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        status=status,
        response_data=json.dumps(response_data, ensure_ascii=False) if response_data else None,
        error_message=error_message
    )
    db.add(log)
    db.flush()
    return log

def get_or_create_member(db: Session, name: str, phone: str) -> Member:
    member = db.query(Member).filter(Member.phone == phone).first()
    if member:
        return member
    member = Member(name=name, phone=phone, status=MemberStatus.ACTIVE)
    db.add(member)
    db.flush()
    return member

def get_or_create_coach(db: Session, name: str, phone: str, 
                        commission_rate: float = 0.5) -> Coach:
    coach = db.query(Coach).filter(Coach.phone == phone).first()
    if coach:
        return coach
    coach = Coach(name=name, phone=phone, commission_rate=commission_rate, 
                  status=CoachStatus.ACTIVE)
    db.add(coach)
    db.flush()
    return coach

def create_package(db: Session, member_id: int, coach_id: int, 
                   total_sessions: int, purchase_date: date, 
                   expire_date: date, price: float) -> Package:
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise ValueError(f"会员不存在: ID={member_id}")
    if member.status != MemberStatus.ACTIVE:
        raise ValueError(f"会员状态无效: {member.status}")
    
    coach = db.query(Coach).filter(Coach.id == coach_id).first()
    if not coach:
        raise ValueError(f"教练不存在: ID={coach_id}")
    if coach.status != CoachStatus.ACTIVE:
        raise ValueError(f"教练状态无效: {coach.status}")
    
    if expire_date <= purchase_date:
        raise ValueError("过期日期必须晚于购买日期")
    
    per_session = price / total_sessions if total_sessions > 0 else 0
    
    package = Package(
        member_id=member_id,
        coach_id=coach_id,
        total_sessions=total_sessions,
        used_sessions=0,
        remaining_sessions=total_sessions,
        purchase_date=purchase_date,
        expire_date=expire_date,
        status=PackageStatus.ACTIVE,
        price=price,
        per_session_price=per_session
    )
    db.add(package)
    db.flush()
    
    add_status_history(
        db, "package", package.id, None, PackageStatus.ACTIVE.value,
        "create_package", None, None, "购买课包"
    )
    
    return package

def check_coach_conflict(db: Session, coach_id: int, start_time: datetime,
                         end_time: datetime, exclude_appointment_id: int = None) -> bool:
    query = db.query(Appointment).filter(
        Appointment.coach_id == coach_id,
        Appointment.status.in_([
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.ATTENDED
        ]),
        Appointment.start_time < end_time,
        Appointment.end_time > start_time
    )
    if exclude_appointment_id:
        query = query.filter(Appointment.id != exclude_appointment_id)
    
    return query.first() is not None

def create_appointment(db: Session, member_id: int, coach_id: int, 
                       package_id: int, start_time: datetime, 
                       end_time: datetime, request_id: str) -> Appointment:
    exists, log = check_idempotency(db, request_id, "create_appointment", "appointment")
    if exists:
        if log.status == "success":
            return db.query(Appointment).filter(Appointment.id == log.entity_id).first()
        else:
            raise ValueError(f"之前请求已失败: {log.error_message}")
    
    try:
        member = db.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise ValueError(f"会员不存在: ID={member_id}")
        if member.status != MemberStatus.ACTIVE:
            raise ValueError(f"会员状态无效")
        
        coach = db.query(Coach).filter(Coach.id == coach_id).first()
        if not coach:
            raise ValueError(f"教练不存在: ID={coach_id}")
        if coach.status != CoachStatus.ACTIVE:
            raise ValueError(f"教练状态无效")
        
        package = db.query(Package).filter(Package.id == package_id).first()
        if not package:
            raise ValueError(f"课包不存在: ID={package_id}")
        
        if package.member_id != member_id:
            raise ValueError("课包不属于该会员")
        
        if package.coach_id != coach_id:
            raise ValueError("课包教练不匹配")
        
        today = date.today()
        if package.status != PackageStatus.ACTIVE:
            raise ValueError(f"课包状态无效: {package.status.value}")
        
        if package.expire_date < today:
            package.status = PackageStatus.EXPIRED
            add_status_history(
                db, "package", package.id, PackageStatus.ACTIVE.value,
                PackageStatus.EXPIRED.value, "expire_check", None, None, "课包过期"
            )
            raise ValueError("课包已过期")
        
        if package.remaining_sessions <= 0:
            package.status = PackageStatus.DEPLETED
            add_status_history(
                db, "package", package.id, PackageStatus.ACTIVE.value,
                PackageStatus.DEPLETED.value, "deplete_check", None, None, "课包耗尽"
            )
            raise ValueError("课包剩余课时不足")
        
        if end_time <= start_time:
            raise ValueError("结束时间必须晚于开始时间")
        
        if start_time < datetime.now():
            raise ValueError("预约时间不能早于当前时间")
        
        if check_coach_conflict(db, coach_id, start_time, end_time):
            raise ValueError("教练时间冲突")
        
        appointment = Appointment(
            member_id=member_id,
            coach_id=coach_id,
            package_id=package_id,
            start_time=start_time,
            end_time=end_time,
            status=AppointmentStatus.PENDING,
            deduction_applied=False,
            request_id=request_id
        )
        db.add(appointment)
        db.flush()
        
        add_status_history(
            db, "appointment", appointment.id, None, AppointmentStatus.PENDING.value,
            "create", request_id, None, "创建预约"
        )
        
        create_idempotency_log(
            db, request_id, "create_appointment", "appointment",
            appointment.id, "success", {"id": appointment.id}
        )
        
        return appointment
    
    except Exception as e:
        create_idempotency_log(
            db, request_id, "create_appointment", "appointment",
            None, "failed", None, str(e)
        )
        raise

def apply_deduction(db: Session, appointment: Appointment, reason: DeductionReason) -> Deduction:
    package = appointment.package
    if package.remaining_sessions < 1:
        raise ValueError("课包剩余课时不足，无法扣课")
    
    deduction = Deduction(
        member_id=appointment.member_id,
        coach_id=appointment.coach_id,
        package_id=appointment.package_id,
        sessions=1,
        reason=reason,
        appointment_id=appointment.id
    )
    db.add(deduction)
    db.flush()
    
    package.used_sessions += 1
    package.remaining_sessions -= 1
    
    if package.remaining_sessions <= 0:
        old_status = package.status
        package.status = PackageStatus.DEPLETED
        add_status_history(
            db, "package", package.id, old_status.value, PackageStatus.DEPLETED.value,
            "auto_deplete", None, None, "课时耗尽"
        )
    
    add_status_history(
        db, "package", package.id, None, package.status.value,
        "deduction", None, None, f"扣课1节，原因: {reason.value}"
    )
    
    appointment.deduction_applied = True
    appointment.deduction_id = deduction.id
    
    return deduction

def create_commission(db: Session, deduction: Deduction, appointment: Appointment) -> Commission:
    coach = appointment.coach
    package = appointment.package
    
    per_session = package.per_session_price
    commission_amount = per_session * coach.commission_rate
    
    commission = Commission(
        coach_id=appointment.coach_id,
        deduction_id=deduction.id,
        appointment_id=appointment.id,
        sessions=1,
        per_session_amount=per_session,
        total_amount=commission_amount,
        commission_rate=coach.commission_rate,
        settlement_date=date.today(),
        is_settled=False
    )
    db.add(commission)
    db.flush()
    
    appointment.commission_id = commission.id
    
    return commission

def confirm_attendance(db: Session, appointment_id: int, request_id: str) -> Appointment:
    exists, log = check_idempotency(db, request_id, "confirm_attendance", "appointment")
    if exists:
        if log.status == "success":
            return db.query(Appointment).filter(Appointment.id == log.entity_id).first()
        else:
            raise ValueError(f"之前请求已失败: {log.error_message}")
    
    try:
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise ValueError(f"预约不存在: ID={appointment_id}")
        
        if appointment.status == AppointmentStatus.ATTENDED:
            create_idempotency_log(
                db, request_id, "confirm_attendance", "appointment",
                appointment.id, "success", {"id": appointment.id, "status": "already_attended"}
            )
            return appointment
        
        if appointment.status not in [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]:
            raise ValueError(f"预约状态不允许确认上课: {appointment.status.value}")
        
        old_status = appointment.status.value
        appointment.status = AppointmentStatus.ATTENDED
        
        add_status_history(
            db, "appointment", appointment.id, old_status, AppointmentStatus.ATTENDED.value,
            "confirm_attendance", request_id, None, "确认上课"
        )
        
        if not appointment.deduction_applied:
            deduction = apply_deduction(db, appointment, DeductionReason.ATTENDED)
            create_commission(db, deduction, appointment)
        
        create_idempotency_log(
            db, request_id, "confirm_attendance", "appointment",
            appointment.id, "success", {"id": appointment.id}
        )
        
        return appointment
    
    except Exception as e:
        create_idempotency_log(
            db, request_id, "confirm_attendance", "appointment",
            appointment_id if 'appointment_id' in locals() else None,
            "failed", None, str(e)
        )
        raise

def request_leave(db: Session, appointment_id: int, request_id: str, 
                  reason: str = None) -> Leave:
    exists, log = check_idempotency(db, request_id, "leave", "appointment")
    if exists:
        if log.status == "success":
            return db.query(Leave).filter(Leave.request_id == request_id).first()
        else:
            raise ValueError(f"之前请求已失败: {log.error_message}")
    
    try:
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise ValueError(f"预约不存在: ID={appointment_id}")
        
        if appointment.status in [AppointmentStatus.CANCELLED, AppointmentStatus.LEAVE]:
            leave = db.query(Leave).filter(Leave.appointment_id == appointment_id).first()
            if leave:
                create_idempotency_log(
                    db, request_id, "leave", "appointment",
                    appointment.id, "success", {"id": leave.id, "status": "already_cancelled"}
                )
                return leave
        
        if appointment.status not in [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]:
            raise ValueError(f"预约状态不允许请假: {appointment.status.value}")
        
        now = datetime.now()
        cutoff_time = appointment.start_time - timedelta(hours=CUTOFF_HOURS_BEFORE)
        is_before_cutoff = now < cutoff_time
        
        old_status = appointment.status.value
        appointment.status = AppointmentStatus.LEAVE if is_before_cutoff else AppointmentStatus.CANCELLED
        
        leave = Leave(
            appointment_id=appointment_id,
            request_time=now,
            is_before_cutoff=is_before_cutoff,
            reason=reason,
            request_id=request_id
        )
        db.add(leave)
        db.flush()
        
        new_status_str = AppointmentStatus.LEAVE.value if is_before_cutoff else AppointmentStatus.CANCELLED.value
        add_status_history(
            db, "appointment", appointment.id, old_status, new_status_str,
            "leave_request", request_id, None,
            f"请假{'成功，不扣课' if is_before_cutoff else '超时，扣课1节'}"
        )
        
        if not is_before_cutoff and not appointment.deduction_applied:
            deduction = apply_deduction(db, appointment, DeductionReason.LATE_CANCEL)
            create_commission(db, deduction, appointment)
        
        create_idempotency_log(
            db, request_id, "leave", "appointment",
            appointment.id, "success",
            {"id": leave.id, "is_before_cutoff": is_before_cutoff}
        )
        
        return leave
    
    except Exception as e:
        create_idempotency_log(
            db, request_id, "leave", "appointment",
            appointment_id if 'appointment_id' in locals() else None,
            "failed", None, str(e)
        )
        raise

def record_no_show(db: Session, appointment_id: int, request_id: str,
                   reason: str = None) -> NoShow:
    exists, log = check_idempotency(db, request_id, "no_show", "appointment")
    if exists:
        if log.status == "success":
            return db.query(NoShow).filter(NoShow.request_id == request_id).first()
        else:
            raise ValueError(f"之前请求已失败: {log.error_message}")
    
    try:
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise ValueError(f"预约不存在: ID={appointment_id}")
        
        if appointment.status == AppointmentStatus.NO_SHOW:
            no_show = db.query(NoShow).filter(NoShow.appointment_id == appointment_id).first()
            if no_show:
                create_idempotency_log(
                    db, request_id, "no_show", "appointment",
                    appointment.id, "success", {"id": no_show.id, "status": "already_recorded"}
                )
                return no_show
        
        if appointment.status not in [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]:
            raise ValueError(f"预约状态不允许记录爽约: {appointment.status.value}")
        
        if datetime.now() < appointment.start_time:
            raise ValueError("课程尚未开始，不能记录爽约")
        
        old_status = appointment.status.value
        appointment.status = AppointmentStatus.NO_SHOW
        
        no_show = NoShow(
            appointment_id=appointment_id,
            record_time=datetime.now(),
            reason=reason,
            request_id=request_id
        )
        db.add(no_show)
        db.flush()
        
        add_status_history(
            db, "appointment", appointment.id, old_status, AppointmentStatus.NO_SHOW.value,
            "record_no_show", request_id, None, "记录爽约"
        )
        
        if not appointment.deduction_applied:
            deduction = apply_deduction(db, appointment, DeductionReason.NO_SHOW)
            create_commission(db, deduction, appointment)
        
        create_idempotency_log(
            db, request_id, "no_show", "appointment",
            appointment.id, "success", {"id": no_show.id}
        )
        
        return no_show
    
    except Exception as e:
        create_idempotency_log(
            db, request_id, "no_show", "appointment",
            appointment_id if 'appointment_id' in locals() else None,
            "failed", None, str(e)
        )
        raise

def transfer_package(db: Session, from_member_id: int, to_member_id: int,
                     package_id: int, transfer_sessions: int, request_id: str) -> Transfer:
    exists, log = check_idempotency(db, request_id, "transfer", "package")
    if exists:
        if log.status == "success":
            return db.query(Transfer).filter(Transfer.request_id == request_id).first()
        else:
            raise ValueError(f"之前请求已失败: {log.error_message}")
    
    try:
        if from_member_id == to_member_id:
            raise ValueError("不能转让给自己")
        
        from_member = db.query(Member).filter(Member.id == from_member_id).first()
        if not from_member:
            raise ValueError(f"转出会员不存在: ID={from_member_id}")
        
        to_member = db.query(Member).filter(Member.id == to_member_id).first()
        if not to_member:
            raise ValueError(f"转入会员不存在: ID={to_member_id}")
        if to_member.status != MemberStatus.ACTIVE:
            raise ValueError("转入会员状态无效")
        
        package = db.query(Package).filter(Package.id == package_id).first()
        if not package:
            raise ValueError(f"课包不存在: ID={package_id}")
        
        if package.member_id != from_member_id:
            raise ValueError("课包不属于转出会员")
        
        if package.status != PackageStatus.ACTIVE:
            raise ValueError(f"课包状态无效: {package.status.value}")
        
        if package.remaining_sessions < transfer_sessions:
            raise ValueError("课包剩余课时不足")
        
        transfer = Transfer(
            from_member_id=from_member_id,
            to_member_id=to_member_id,
            package_id=package_id,
            transfer_sessions=transfer_sessions,
            transfer_date=datetime.now(),
            request_id=request_id
        )
        db.add(transfer)
        db.flush()
        
        remaining_after = package.remaining_sessions - transfer_sessions
        if remaining_after <= 0:
            package.status = PackageStatus.TRANSFERRED
            add_status_history(
                db, "package", package.id, PackageStatus.ACTIVE.value,
                PackageStatus.TRANSFERRED.value, "transfer_out", request_id, None,
                f"转出全部{transfer_sessions}节课"
            )
        else:
            add_status_history(
                db, "package", package.id, package.status.value, package.status.value,
                "partial_transfer_out", request_id, None,
                f"转出{transfer_sessions}节课，剩余{remaining_after}节"
            )
        
        package.remaining_sessions = remaining_after
        
        deduction = Deduction(
            member_id=from_member_id,
            coach_id=package.coach_id,
            package_id=package_id,
            sessions=transfer_sessions,
            reason=DeductionReason.TRANSFER,
            transfer_id=transfer.id
        )
        db.add(deduction)
        db.flush()
        
        new_package = Package(
            member_id=to_member_id,
            coach_id=package.coach_id,
            total_sessions=transfer_sessions,
            used_sessions=0,
            remaining_sessions=transfer_sessions,
            purchase_date=date.today(),
            expire_date=package.expire_date,
            status=PackageStatus.ACTIVE,
            price=package.per_session_price * transfer_sessions,
            per_session_price=package.per_session_price
        )
        db.add(new_package)
        db.flush()
        
        add_status_history(
            db, "package", new_package.id, None, PackageStatus.ACTIVE.value,
            "transfer_in", request_id, None,
            f"从会员{from_member.name}转入{transfer_sessions}节课"
        )
        
        create_idempotency_log(
            db, request_id, "transfer", "package",
            package.id, "success",
            {"transfer_id": transfer.id, "new_package_id": new_package.id}
        )
        
        return transfer
    
    except Exception as e:
        create_idempotency_log(
            db, request_id, "transfer", "package",
            package_id if 'package_id' in locals() else None,
            "failed", None, str(e)
        )
        raise

def apply_manual_correction(db: Session, entity_type: str, entity_id: int,
                            after_data: dict, operator: str, reason: str,
                            request_id: str) -> ManualCorrection:
    exists, log = check_idempotency(db, request_id, "manual_correction", entity_type)
    if exists:
        if log.status == "success":
            return db.query(ManualCorrection).filter(ManualCorrection.request_id == request_id).first()
        else:
            raise ValueError(f"之前请求已失败: {log.error_message}")
    
    try:
        entity_map = {
            "member": Member,
            "coach": Coach,
            "package": Package,
            "appointment": Appointment
        }
        
        if entity_type not in entity_map:
            raise ValueError(f"不支持的实体类型: {entity_type}")
        
        ModelClass = entity_map[entity_type]
        entity = db.query(ModelClass).filter(ModelClass.id == entity_id).first()
        if not entity:
            raise ValueError(f"{entity_type}不存在: ID={entity_id}")
        
        before_data = {}
        for key, value in after_data.items():
            if hasattr(entity, key):
                before_data[key] = getattr(entity, key)
                setattr(entity, key, value)
        
        correction = ManualCorrection(
            entity_type=entity_type,
            entity_id=entity_id,
            before_data=json.dumps(before_data, ensure_ascii=False, default=str),
            after_data=json.dumps(after_data, ensure_ascii=False, default=str),
            operator=operator,
            reason=reason,
            request_id=request_id
        )
        db.add(correction)
        db.flush()
        
        if hasattr(entity, 'status'):
            old_status = before_data.get('status', None)
            new_status = after_data.get('status', getattr(entity, 'status', None))
            if old_status != new_status:
                add_status_history(
                    db, entity_type, entity_id,
                    str(old_status) if old_status else None,
                    str(new_status) if new_status else None,
                    "manual_correction", request_id, operator, reason
                )
        
        create_idempotency_log(
            db, request_id, "manual_correction", entity_type,
            entity_id, "success", {"correction_id": correction.id}
        )
        
        return correction
    
    except Exception as e:
        create_idempotency_log(
            db, request_id, "manual_correction", entity_type,
            entity_id if 'entity_id' in locals() else None,
            "failed", None, str(e)
        )
        raise
