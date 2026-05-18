from sqlalchemy.orm import Session
from typing import List, Tuple, Dict, Any
from datetime import datetime, timedelta
import uuid
import json

from models import (
    Room, Course, RoomSwap, Notification, SignInCode, AuditLog,
    Student, RoomDevice, DeviceRequirement,
    SwapStatus, NotificationStatus, DeviceType
)
import schemas


def json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def generate_swap_code() -> str:
    return f"SWAP-{uuid.uuid4().hex[:8].upper()}"


def generate_sign_in_code() -> str:
    return f"SIGN-{uuid.uuid4().hex[:6].upper()}"


def check_room_capacity(db: Session, room_id: int, student_count: int) -> Tuple[bool, str]:
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        return False, f"教室ID {room_id} 不存在"
    
    if room.capacity < student_count:
        return False, f"教室容量不足: 需要{student_count}人, 教室容量{room.capacity}人"
    
    return True, f"容量检查通过: {room.capacity} >= {student_count}"


def check_device_match(db: Session, room_id: int, course_id: int) -> Tuple[bool, str, List[str]]:
    room = db.query(Room).filter(Room.id == room_id).first()
    course = db.query(Course).filter(Course.id == course_id).first()
    
    if not room or not course:
        return False, "教室或课程不存在", []
    
    issues = []
    room_devices = db.query(RoomDevice).filter(
        RoomDevice.room_id == room_id,
        RoomDevice.is_working == True
    ).all()
    
    device_map = {}
    for dev in room_devices:
        if dev.device_type not in device_map:
            device_map[dev.device_type] = 0
        device_map[dev.device_type] += dev.quantity
    
    requirements = db.query(DeviceRequirement).filter(
        DeviceRequirement.course_id == course_id
    ).all()
    
    for req in requirements:
        available = device_map.get(req.device_type, 0)
        if available < req.min_quantity:
            issues.append(
                f"{req.device_type}: 需要{req.min_quantity}个, 可用{available}个"
            )
    
    if issues:
        return False, "设备检查未通过", issues
    
    return True, "设备检查全部通过", []


def create_audit_log(
    db: Session,
    swap_id: int,
    action: str,
    operator: str,
    previous_status: str = None,
    new_status: str = None,
    original_input: str = None,
    conclusion: str = None,
    remarks: str = None
):
    audit = AuditLog(
        swap_id=swap_id,
        action=action,
        operator=operator,
        previous_status=previous_status,
        new_status=new_status,
        original_input=original_input,
        conclusion=conclusion,
        remarks=remarks
    )
    db.add(audit)
    db.commit()
    return audit


def create_room_swap(db: Session, swap_data: schemas.RoomSwapCreate) -> RoomSwap:
    original_input = json.dumps(swap_data.model_dump(), ensure_ascii=False, default=json_serializer)
    
    swap = RoomSwap(
        swap_code=generate_swap_code(),
        course_id=swap_data.course_id,
        original_room_id=swap_data.original_room_id,
        target_room_id=swap_data.target_room_id,
        reason=swap_data.reason,
        scheduled_time=swap_data.scheduled_time,
        created_by=swap_data.created_by,
        original_input=original_input,
        status=SwapStatus.DRAFT
    )
    
    course = db.query(Course).filter(Course.id == swap_data.course_id).first()
    if course:
        capacity_ok, capacity_msg = check_room_capacity(
            db, swap_data.target_room_id, course.student_count
        )
        swap.check_capacity_pass = capacity_ok
        
        device_ok, device_msg, device_issues = check_device_match(
            db, swap_data.target_room_id, swap_data.course_id
        )
        swap.check_devices_pass = device_ok
    
    db.add(swap)
    db.commit()
    db.refresh(swap)
    
    create_audit_log(
        db, swap.id, "创建调换申请", swap_data.created_by,
        previous_status=None, new_status=SwapStatus.DRAFT,
        original_input=original_input,
        conclusion=f"容量检查: {'通过' if swap.check_capacity_pass else '不通过'}, 设备检查: {'通过' if swap.check_devices_pass else '不通过'}"
    )
    
    return swap


def update_swap_status(
    db: Session,
    swap_id: int,
    new_status: SwapStatus,
    operator: str,
    remarks: str = None
) -> Tuple[RoomSwap, bool, str]:
    swap = db.query(RoomSwap).filter(RoomSwap.id == swap_id).first()
    if not swap:
        return None, False, "调换记录不存在"
    
    valid_transitions = {
        SwapStatus.DRAFT: [SwapStatus.PENDING_APPROVAL, SwapStatus.CANCELLED],
        SwapStatus.PENDING_APPROVAL: [SwapStatus.APPROVED, SwapStatus.REJECTED, SwapStatus.DRAFT],
        SwapStatus.APPROVED: [SwapStatus.NOTIFYING, SwapStatus.CANCELLED],
        SwapStatus.NOTIFYING: [SwapStatus.ALL_CONFIRMED, SwapStatus.CANCELLED],
        SwapStatus.ALL_CONFIRMED: [SwapStatus.COMPLETED, SwapStatus.CLOSED],
        SwapStatus.COMPLETED: [SwapStatus.CLOSED],
        SwapStatus.REJECTED: [SwapStatus.DRAFT, SwapStatus.CLOSED],
        SwapStatus.CANCELLED: [SwapStatus.DRAFT, SwapStatus.CLOSED],
        SwapStatus.CLOSED: []
    }
    
    old_status = swap.status
    if new_status not in valid_transitions.get(old_status, []):
        return swap, False, f"不允许从 {old_status} 转换到 {new_status}"
    
    if new_status in [SwapStatus.APPROVED, SwapStatus.NOTIFYING]:
        if not swap.check_capacity_pass:
            return swap, False, "容量检查未通过，无法继续"
        if not swap.check_devices_pass:
            return swap, False, "设备检查未通过，无法继续"
    
    swap.status = new_status
    swap.handled_by = operator
    swap.handle_conclusion = remarks
    
    create_audit_log(
        db, swap.id, f"状态变更: {old_status} -> {new_status}",
        operator, previous_status=old_status, new_status=new_status,
        remarks=remarks
    )
    
    db.commit()
    db.refresh(swap)
    
    return swap, True, "状态更新成功"


def create_notifications_for_swap(db: Session, swap_id: int) -> Tuple[List[Notification], str]:
    swap = db.query(RoomSwap).filter(RoomSwap.id == swap_id).first()
    if not swap:
        return [], "调换记录不存在"
    
    if swap.status not in [SwapStatus.APPROVED, SwapStatus.NOTIFYING]:
        return [], "只有已批准或通知中状态才能创建通知"
    
    course = db.query(Course).filter(Course.id == swap.course_id).first()
    if not course:
        return [], "课程不存在"
    
    students = db.query(Student).filter(Student.course_id == swap.course_id).all()
    if not students:
        return [], "课程没有学员"
    
    notifications = []
    for student in students:
        content = (
            f"【教室调换通知】\n"
            f"课程: {course.name}\n"
            f"原教室: {swap.original_room.name if swap.original_room else '未知'}\n"
            f"新教室: {swap.target_room.name if swap.target_room else '未知'}\n"
            f"时间: {swap.scheduled_time.strftime('%Y-%m-%d %H:%M')}\n"
            f"请确认收到此通知！"
        )
        
        notification = Notification(
            swap_id=swap_id,
            student_id=student.id,
            content=content,
            status=NotificationStatus.PENDING
        )
        db.add(notification)
        notifications.append(notification)
    
    swap.status = SwapStatus.NOTIFYING
    db.commit()
    
    create_audit_log(
        db, swap.id, "创建学员通知",
        swap.handled_by or "system",
        previous_status=SwapStatus.APPROVED, new_status=SwapStatus.NOTIFYING,
        conclusion=f"已为 {len(notifications)} 名学员创建通知"
    )
    
    return notifications, "通知创建成功"


def confirm_notification(
    db: Session,
    notification_id: int,
    confirmed_by: str
) -> Tuple[Notification, bool, str]:
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        return None, False, "通知不存在"
    
    if notification.status == NotificationStatus.CONFIRMED:
        return notification, False, "通知已确认"
    
    notification.status = NotificationStatus.CONFIRMED
    notification.confirmed_at = datetime.utcnow()
    notification.confirmed_by = confirmed_by
    
    db.commit()
    db.refresh(notification)
    
    swap = db.query(RoomSwap).filter(RoomSwap.id == notification.swap_id).first()
    if swap:
        all_notifications = db.query(Notification).filter(Notification.swap_id == swap.id).all()
        all_confirmed = all(n.status == NotificationStatus.CONFIRMED for n in all_notifications)
        
        if all_confirmed and swap.status == SwapStatus.NOTIFYING:
            swap.status = SwapStatus.ALL_CONFIRMED
            db.commit()
            
            create_audit_log(
                db, swap.id, "全部学员已确认",
                confirmed_by,
                previous_status=SwapStatus.NOTIFYING, new_status=SwapStatus.ALL_CONFIRMED
            )
    
    return notification, True, "确认成功"


def refresh_sign_in_code(
    db: Session,
    swap_id: int,
    new_code: str,
    operator: str
) -> Tuple[SignInCode, bool, str]:
    swap = db.query(RoomSwap).filter(RoomSwap.id == swap_id).first()
    if not swap:
        return None, False, "调换记录不存在"
    
    existing = db.query(SignInCode).filter(SignInCode.swap_id == swap_id).first()
    
    if existing:
        existing.original_code = existing.code
        existing.code = new_code
        existing.new_code = new_code
        existing.refreshed_at = datetime.utcnow()
        existing.refresh_count += 1
        sign_in_code = existing
    else:
        sign_in_code = SignInCode(
            swap_id=swap_id,
            code=new_code,
            new_code=new_code,
            refresh_count=1
        )
        db.add(sign_in_code)
    
    db.commit()
    db.refresh(sign_in_code)
    
    create_audit_log(
        db, swap.id, "刷新签到码",
        operator,
        conclusion=f"新签到码: {new_code}, 刷新次数: {sign_in_code.refresh_count}"
    )
    
    return sign_in_code, True, "签到码刷新成功"


def cancel_swap(
    db: Session,
    swap_id: int,
    operator: str,
    reason: str
) -> Tuple[RoomSwap, bool, str]:
    swap = db.query(RoomSwap).filter(RoomSwap.id == swap_id).first()
    if not swap:
        return None, False, "调换记录不存在"
    
    if swap.status == SwapStatus.CLOSED:
        return swap, False, "已关闭的调换无法撤回"
    
    old_status = swap.status
    swap.status = SwapStatus.CANCELLED
    swap.handle_conclusion = reason
    
    create_audit_log(
        db, swap.id, "撤回/取消调换",
        operator,
        previous_status=old_status, new_status=SwapStatus.CANCELLED,
        conclusion=reason
    )
    
    db.commit()
    db.refresh(swap)
    
    return swap, True, "撤回成功"


def close_swap(
    db: Session,
    swap_id: int,
    operator: str,
    conclusion: str
) -> Tuple[RoomSwap, bool, str]:
    swap = db.query(RoomSwap).filter(RoomSwap.id == swap_id).first()
    if not swap:
        return None, False, "调换记录不存在"
    
    old_status = swap.status
    swap.status = SwapStatus.CLOSED
    swap.actual_time = datetime.utcnow()
    swap.handle_conclusion = conclusion
    
    create_audit_log(
        db, swap.id, "关闭调换",
        operator,
        previous_status=old_status, new_status=SwapStatus.CLOSED,
        conclusion=conclusion
    )
    
    db.commit()
    db.refresh(swap)
    
    return swap, True, "关闭成功"


def manual_correction(
    db: Session,
    swap_id: int,
    correction: schemas.ManualCorrection
) -> Tuple[RoomSwap, bool, str]:
    swap = db.query(RoomSwap).filter(RoomSwap.id == swap_id).first()
    if not swap:
        return None, False, "调换记录不存在"
    
    field_map = {
        "reason": "reason",
        "scheduled_time": "scheduled_time",
        "target_room_id": "target_room_id"
    }
    
    field = field_map.get(correction.field_name)
    if not field:
        return swap, False, f"不支持修改字段: {correction.field_name}"
    
    old_value = str(getattr(swap, field))
    setattr(swap, field, correction.new_value)
    
    create_audit_log(
        db, swap.id, "人工修正",
        correction.operator,
        original_input=f"{correction.field_name}: {correction.old_value} -> {correction.new_value}",
        conclusion=correction.reason
    )
    
    if correction.field_name == "target_room_id":
        course = db.query(Course).filter(Course.id == swap.course_id).first()
        if course:
            capacity_ok, _ = check_room_capacity(
                db, int(correction.new_value), course.student_count
            )
            swap.check_capacity_pass = capacity_ok
            
            device_ok, _, _ = check_device_match(
                db, int(correction.new_value), swap.course_id
            )
            swap.check_devices_pass = device_ok
    
    db.commit()
    db.refresh(swap)
    
    return swap, True, "修正成功"


def generate_swap_report(db: Session, swap_id: int) -> Dict[str, Any]:
    swap = db.query(RoomSwap).filter(RoomSwap.id == swap_id).first()
    if not swap:
        return {}
    
    notifications = db.query(Notification).filter(Notification.swap_id == swap_id).all()
    confirmed_count = sum(1 for n in notifications if n.status == NotificationStatus.CONFIRMED)
    
    sign_in_code = db.query(SignInCode).filter(SignInCode.swap_id == swap_id).first()
    
    return {
        "swap_code": swap.swap_code,
        "course_name": swap.course.name if swap.course else "",
        "original_room": swap.original_room.name if swap.original_room else "",
        "target_room": swap.target_room.name if swap.target_room else "",
        "scheduled_time": swap.scheduled_time,
        "status": swap.status,
        "created_by": swap.created_by,
        "capacity_check": "通过" if swap.check_capacity_pass else "不通过",
        "device_check": "通过" if swap.check_devices_pass else "不通过",
        "notification_confirmed": confirmed_count,
        "notification_total": len(notifications),
        "sign_in_code_refreshed": sign_in_code.refresh_count > 0 if sign_in_code else False
    }
