from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional
import json

from app import models, schemas
from app.models import RepairStatus, UrgencyLevel


OVERDUE_RULES = {
    UrgencyLevel.LOW: timedelta(hours=72),
    UrgencyLevel.MEDIUM: timedelta(hours=24),
    UrgencyLevel.HIGH: timedelta(hours=4),
    UrgencyLevel.EMERGENCY: timedelta(minutes=30),
}

REMINDER_DUPLICATE_WINDOW = timedelta(hours=1)


def generate_order_no(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    last_order = db.query(models.RepairOrder).filter(
        models.RepairOrder.order_no.like(f"BX{today}%")
    ).order_by(models.RepairOrder.order_no.desc()).first()
    
    if last_order:
        last_num = int(last_order.order_no[-4:])
        new_num = str(last_num + 1).zfill(4)
    else:
        new_num = "0001"
    return f"BX{today}{new_num}"


def check_overdue(db: Session, order: models.RepairOrder) -> bool:
    if order.status in [RepairStatus.COMPLETED, RepairStatus.VERIFIED, 
                        RepairStatus.CLOSED, RepairStatus.CANCELLED]:
        return False
    
    if not order.reported_at:
        return False
        
    overdue_time = OVERDUE_RULES.get(order.urgency, OVERDUE_RULES[UrgencyLevel.MEDIUM])
    deadline = order.reported_at + overdue_time
    is_overdue = datetime.now() > deadline
    
    if is_overdue != order.is_overdue:
        order.is_overdue = is_overdue
        db.commit()
    
    return is_overdue


def check_duplicate_reminder(db: Session, order_id: int, content: str) -> bool:
    window_start = datetime.now() - REMINDER_DUPLICATE_WINDOW
    recent_reminders = db.query(models.ReminderRecord).filter(
        and_(
            models.ReminderRecord.repair_order_id == order_id,
            models.ReminderRecord.reminder_time >= window_start
        )
    ).all()
    
    for reminder in recent_reminders:
        if reminder.reminder_content and content and \
           similarity(reminder.reminder_content, content) > 0.7:
            return True
    return False


def similarity(s1: str, s2: str) -> float:
    if not s1 or not s2:
        return 0.0
    s1_chars = set(s1)
    s2_chars = set(s2)
    if not s1_chars or not s2_chars:
        return 0.0
    return len(s1_chars.intersection(s2_chars)) / len(s1_chars.union(s2_chars))


def check_duplicate_order(db: Session, new_order: schemas.RepairOrderCreate) -> Optional[models.RepairOrder]:
    window_start = datetime.now() - timedelta(hours=24)
    similar_orders = db.query(models.RepairOrder).filter(
        and_(
            models.RepairOrder.building_id == new_order.building_id,
            models.RepairOrder.reported_at >= window_start,
            models.RepairOrder.status.not_in([
                RepairStatus.COMPLETED, RepairStatus.VERIFIED, 
                RepairStatus.CLOSED, RepairStatus.CANCELLED
            ]),
            models.RepairOrder.is_duplicate == False
        )
    ).all()
    
    for order in similar_orders:
        if order.repair_type == new_order.repair_type or \
           (order.description and new_order.description and 
            similarity(order.description, new_order.description) > 0.6):
            return order
    return None


def create_audit_log(db: Session, order_id: int, action: str, operator: str,
                     old_status: str = None, new_status: str = None,
                     original_input: dict = None, conclusion: str = None,
                     reason: str = None):
    audit_log = models.AuditLog(
        repair_order_id=order_id,
        action=action,
        old_status=old_status,
        new_status=new_status,
        operator=operator,
        original_input=json.dumps(original_input, ensure_ascii=False) if original_input else None,
        conclusion=conclusion,
        reason=reason
    )
    db.add(audit_log)
    db.commit()
    return audit_log


def get_building(db: Session, building_id: int):
    return db.query(models.Building).filter(models.Building.id == building_id).first()


def get_buildings(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Building).offset(skip).limit(limit).all()


def create_building(db: Session, building: schemas.BuildingCreate):
    db_building = models.Building(**building.dict())
    db.add(db_building)
    db.commit()
    db.refresh(db_building)
    return db_building


def get_handler(db: Session, handler_id: int):
    return db.query(models.Handler).filter(models.Handler.id == handler_id).first()


def get_handlers(db: Session, skip: int = 0, limit: int = 100, is_outsourcer: bool = None):
    query = db.query(models.Handler)
    if is_outsourcer is not None:
        query = query.filter(models.Handler.is_outsourcer == is_outsourcer)
    return query.offset(skip).limit(limit).all()


def create_handler(db: Session, handler: schemas.HandlerCreate):
    db_handler = models.Handler(**handler.dict())
    db.add(db_handler)
    db.commit()
    db.refresh(db_handler)
    return db_handler


def create_repair_order(db: Session, order: schemas.RepairOrderCreate):
    duplicate_order = check_duplicate_order(db, order)
    
    order_no = generate_order_no(db)
    db_order = models.RepairOrder(
        order_no=order_no,
        **order.dict()
    )
    
    if duplicate_order:
        db_order.is_duplicate = True
        db_order.merged_into_order_id = duplicate_order.id
    
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    check_overdue(db, db_order)
    
    create_audit_log(
        db, db_order.id, "create", 
        operator="system",
        new_status=db_order.status,
        original_input=order.dict(),
        conclusion="报修单创建成功" + ("（检测到重复工单）" if duplicate_order else "")
    )
    
    return db_order


def get_repair_order(db: Session, order_id: int):
    order = db.query(models.RepairOrder).filter(models.RepairOrder.id == order_id).first()
    if order:
        check_overdue(db, order)
    return order


def get_repair_order_by_no(db: Session, order_no: str):
    order = db.query(models.RepairOrder).filter(models.RepairOrder.order_no == order_no).first()
    if order:
        check_overdue(db, order)
    return order


def get_repair_orders(db: Session, skip: int = 0, limit: int = 100,
                      status: RepairStatus = None, is_overdue: bool = None,
                      is_outsourced: bool = None, building_id: int = None):
    query = db.query(models.RepairOrder)
    
    if status:
        query = query.filter(models.RepairOrder.status == status)
    if is_overdue is not None:
        query = query.filter(models.RepairOrder.is_overdue == is_overdue)
    if building_id:
        query = query.filter(models.RepairOrder.building_id == building_id)
    if is_outsourced:
        query = query.filter(models.RepairOrder.status == RepairStatus.OUTSOURCED)
    
    orders = query.offset(skip).limit(limit).all()
    for order in orders:
        check_overdue(db, order)
    
    return orders


def update_repair_order_status(db: Session, order_id: int, status_update: schemas.StatusUpdate):
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None
    
    old_status = db_order.status
    new_status = status_update.new_status
    
    if new_status == RepairStatus.COMPLETED:
        db_order.actual_completion_time = datetime.now()
    
    db_order.status = new_status
    db.commit()
    db.refresh(db_order)
    
    create_audit_log(
        db, order_id, "status_update",
        operator=status_update.operator,
        old_status=old_status,
        new_status=new_status,
        original_input=status_update.dict(),
        conclusion=status_update.conclusion,
        reason=status_update.reason
    )
    
    check_overdue(db, db_order)
    return db_order


def update_repair_order(db: Session, order_id: int, order_update: schemas.RepairOrderUpdate, operator: str):
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None
    
    old_data = {
        "reporter_name": db_order.reporter_name,
        "repair_type": db_order.repair_type,
        "urgency": db_order.urgency,
        "handler_id": db_order.handler_id
    }
    
    update_data = order_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_order, key, value)
    
    db.commit()
    db.refresh(db_order)
    
    create_audit_log(
        db, order_id, "update",
        operator=operator,
        original_input={"old": old_data, "new": update_data},
        conclusion="报修单信息更新成功"
    )
    
    return db_order


def add_reminder(db: Session, order_id: int, reminder: schemas.ReminderCreate):
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None
    
    is_duplicate = check_duplicate_reminder(db, order_id, reminder.reminder_content or "")
    
    db_reminder = models.ReminderRecord(
        repair_order_id=order_id,
        **reminder.dict(),
        is_duplicate=is_duplicate
    )
    db.add(db_reminder)
    db.commit()
    db.refresh(db_reminder)
    
    if is_duplicate:
        create_audit_log(
            db, order_id, "duplicate_reminder",
            operator=reminder.reminder_by or "system",
            original_input=reminder.dict(),
            conclusion="检测到重复催办，已合并记录"
        )
    
    return db_reminder


def create_outsourcing(db: Session, order_id: int, outsourcing: schemas.OutsourcingCreate, operator: str):
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None
    
    db_outsourcing = models.OutsourcingRecord(
        repair_order_id=order_id,
        **outsourcing.dict()
    )
    db.add(db_outsourcing)
    db.commit()
    db.refresh(db_outsourcing)
    
    db_order.status = RepairStatus.OUTSOURCED
    db_order.handler_id = outsourcing.outsourcer_id
    db.commit()
    
    create_audit_log(
        db, order_id, "outsourcing",
        operator=operator,
        old_status=RepairStatus.PENDING,
        new_status=RepairStatus.OUTSOURCED,
        original_input=outsourcing.dict(),
        conclusion="已转外包处理"
    )
    
    return db_outsourcing


def get_outsourcing_records(db: Session, order_id: int = None):
    query = db.query(models.OutsourcingRecord)
    if order_id:
        query = query.filter(models.OutsourcingRecord.repair_order_id == order_id)
    return query.all()


def add_completion_proof(db: Session, order_id: int, proof: schemas.CompletionProofUpload):
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None
    
    db_proof = models.CompletionProof(
        repair_order_id=order_id,
        **proof.dict()
    )
    db.add(db_proof)
    db.commit()
    db.refresh(db_proof)
    
    return db_proof


def verify_completion_proof(db: Session, proof_id: int, verified_by: str):
    db_proof = db.query(models.CompletionProof).filter(models.CompletionProof.id == proof_id).first()
    if not db_proof:
        return None
    
    db_proof.is_verified = True
    db_proof.verified_by = verified_by
    db_proof.verified_at = datetime.now()
    db.commit()
    db.refresh(db_proof)
    
    db_order = get_repair_order(db, db_proof.repair_order_id)
    if db_order and db_order.status == RepairStatus.COMPLETED:
        old_status = db_order.status
        db_order.status = RepairStatus.VERIFIED
        db.commit()
        db.refresh(db_order)
        
        create_audit_log(
            db, db_proof.repair_order_id, "verify_completion",
            operator=verified_by,
            old_status=old_status,
            new_status=RepairStatus.VERIFIED,
            original_input={"proof_id": proof_id},
            conclusion="完工证明已复核，工单状态更新为已复核"
        )
    
    return db_proof


def merge_duplicate_order(db: Session, source_order_id: int, target_order_id: int, operator: str, reason: str = None):
    source_order = get_repair_order(db, source_order_id)
    target_order = get_repair_order(db, target_order_id)
    
    if not source_order or not target_order:
        return None
    
    source_order.is_duplicate = True
    source_order.merged_into_order_id = target_order_id
    source_order.status = RepairStatus.CANCELLED
    db.commit()
    
    create_audit_log(
        db, source_order_id, "merge",
        operator=operator,
        old_status=source_order.status,
        new_status=RepairStatus.CANCELLED,
        original_input={"target_order_id": target_order_id, "target_order_no": target_order.order_no},
        conclusion=f"工单已合并至 {target_order.order_no}",
        reason=reason
    )
    
    return source_order


def manual_correction(db: Session, order_id: int, correction: schemas.ManualCorrection):
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None
    
    create_audit_log(
        db, order_id, "manual_correction",
        operator=correction.operator,
        original_input=correction.dict(),
        conclusion=f"人工修正字段 {correction.field_name}",
        reason=correction.reason
    )
    
    if hasattr(db_order, correction.field_name):
        setattr(db_order, correction.field_name, correction.new_value)
        db.commit()
        db.refresh(db_order)
    
    return db_order


def close_order(db: Session, order_id: int, operator: str, reason: str = None):
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None
    
    old_status = db_order.status
    db_order.status = RepairStatus.CLOSED
    db.commit()
    db.refresh(db_order)
    
    create_audit_log(
        db, order_id, "close",
        operator=operator,
        old_status=old_status,
        new_status=RepairStatus.CLOSED,
        conclusion="工单已关闭",
        reason=reason
    )
    
    return db_order


def cancel_order(db: Session, order_id: int, operator: str, reason: str = None):
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None
    
    old_status = db_order.status
    db_order.status = RepairStatus.CANCELLED
    db.commit()
    db.refresh(db_order)
    
    create_audit_log(
        db, order_id, "cancel",
        operator=operator,
        old_status=old_status,
        new_status=RepairStatus.CANCELLED,
        conclusion="工单已撤回/取消",
        reason=reason
    )
    
    return db_order


def get_audit_logs(db: Session, order_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.AuditLog)
    if order_id:
        query = query.filter(models.AuditLog.repair_order_id == order_id)
    return query.order_by(models.AuditLog.created_at.desc()).offset(skip).limit(limit).all()


def get_overdue_orders(db: Session, skip: int = 0, limit: int = 100):
    active_statuses = [
        RepairStatus.PENDING,
        RepairStatus.ASSIGNED,
        RepairStatus.OUTSOURCED,
        RepairStatus.IN_PROGRESS
    ]
    query = db.query(models.RepairOrder).filter(
        models.RepairOrder.status.in_(active_statuses)
    )
    
    all_active_orders = query.all()
    for order in all_active_orders:
        check_overdue(db, order)
    
    query = db.query(models.RepairOrder).filter(
        models.RepairOrder.status.in_(active_statuses),
        models.RepairOrder.is_overdue == True
    )
    orders = query.offset(skip).limit(limit).all()
    
    return orders


def get_outsourced_orders(db: Session, skip: int = 0, limit: int = 100):
    return get_repair_orders(db, skip, limit, status=RepairStatus.OUTSOURCED)


def get_orders_with_duplicate_reminders(db: Session, skip: int = 0, limit: int = 100):
    order_ids = db.query(models.ReminderRecord.repair_order_id).filter(
        models.ReminderRecord.is_duplicate == True
    ).distinct().all()
    
    order_ids = [oid[0] for oid in order_ids]
    orders = db.query(models.RepairOrder).filter(models.RepairOrder.id.in_(order_ids)).offset(skip).limit(limit).all()
    
    for order in orders:
        check_overdue(db, order)
    
    return orders
