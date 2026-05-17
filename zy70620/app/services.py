from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import json
from app.models import (
    RepairOrder, RepairOrderStatus, Handler, Reminder,
    Outsourcing, CompletionProof, ExceptionRecord, UrgencyLevel
)
from app import schemas


def generate_order_no(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    last_order = db.query(RepairOrder).filter(
        RepairOrder.order_no.like(f"BX{today}%")
    ).order_by(RepairOrder.id.desc()).first()
    if last_order:
        last_num = int(last_order.order_no[-4:])
        return f"BX{today}{str(last_num + 1).zfill(4)}"
    return f"BX{today}0001"


def check_timeout(db: Session, order: RepairOrder) -> bool:
    if order.status in [RepairOrderStatus.COMPLETED, RepairOrderStatus.VERIFIED,
                        RepairOrderStatus.CLOSED, RepairOrderStatus.CANCELLED]:
        return False
    time_elapsed = datetime.utcnow() - order.created_at
    is_timeout = time_elapsed.total_seconds() > order.timeout_hours * 3600
    if is_timeout != order.is_timeout:
        order.is_timeout = is_timeout
        db.commit()
    return is_timeout


def check_duplicate_order(db: Session, order_data: schemas.RepairOrderCreate) -> Optional[RepairOrder]:
    time_threshold = datetime.utcnow() - timedelta(hours=2)
    duplicate = db.query(RepairOrder).filter(
        and_(
            RepairOrder.building == order_data.building,
            RepairOrder.room_number == order_data.room_number,
            RepairOrder.issue_type == order_data.issue_type,
            RepairOrder.created_at > time_threshold,
            RepairOrder.status.notin([
                RepairOrderStatus.COMPLETED,
                RepairOrderStatus.VERIFIED,
                RepairOrderStatus.CLOSED,
                RepairOrderStatus.CANCELLED
            ])
        )
    ).first()
    return duplicate


def create_repair_order(db: Session, order_data: schemas.RepairOrderCreate) -> RepairOrder:
    original_order = check_duplicate_order(db, order_data)
    order_no = generate_order_no(db)
    
    db_order = RepairOrder(
        order_no=order_no,
        building=order_data.building,
        room_number=order_data.room_number,
        contact_name=order_data.contact_name,
        contact_phone=order_data.contact_phone,
        issue_type=order_data.issue_type,
        description=order_data.description,
        urgency=order_data.urgency,
        timeout_hours=order_data.timeout_hours,
        is_duplicated=original_order is not None,
        original_order_id=original_order.id if original_order else None
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


def merge_reminders(db: Session, order_id: int, operator: str) -> int:
    reminders = db.query(Reminder).filter(
        and_(
            Reminder.repair_order_id == order_id,
            Reminder.is_merged == False
        )
    ).order_by(Reminder.created_at).all()
    
    if len(reminders) <= 1:
        return 0
    
    main_reminder = reminders[0]
    merged_content = [main_reminder.reminder_content]
    
    for reminder in reminders[1:]:
        reminder.is_merged = True
        reminder.merged_into_id = main_reminder.id
        merged_content.append(reminder.reminder_content)
    
    main_reminder.reminder_content = "\n---\n".join(merged_content)
    db.commit()
    return len(reminders) - 1


def transition_status(
    db: Session,
    order_id: int,
    target_status: RepairOrderStatus,
    operator: str,
    remarks: Optional[str] = None
) -> RepairOrder:
    order = db.query(RepairOrder).filter(RepairOrder.id == order_id).first()
    if not order:
        raise ValueError("Repair order not found")
    
    valid_transitions = {
        RepairOrderStatus.PENDING: [RepairOrderStatus.PROCESSING, RepairOrderStatus.CANCELLED],
        RepairOrderStatus.PROCESSING: [RepairOrderStatus.OUTSOURCED, RepairOrderStatus.COMPLETED, RepairOrderStatus.CANCELLED],
        RepairOrderStatus.OUTSOURCED: [RepairOrderStatus.COMPLETED, RepairOrderStatus.CANCELLED],
        RepairOrderStatus.COMPLETED: [RepairOrderStatus.VERIFIED, RepairOrderStatus.PROCESSING],
        RepairOrderStatus.VERIFIED: [RepairOrderStatus.CLOSED],
        RepairOrderStatus.CLOSED: [],
        RepairOrderStatus.CANCELLED: []
    }
    
    if target_status not in valid_transitions.get(order.status, []):
        raise ValueError(f"Invalid status transition from {order.status} to {target_status}")
    
    old_status = order.status
    order.status = target_status
    
    if target_status == RepairOrderStatus.COMPLETED:
        order.completed_at = datetime.utcnow()
    elif target_status == RepairOrderStatus.CLOSED:
        order.closed_at = datetime.utcnow()
    
    exception_record = ExceptionRecord(
        repair_order_id=order_id,
        operation_type="status_transition",
        original_input=json.dumps({
            "old_status": str(old_status),
            "target_status": str(target_status),
            "remarks": remarks
        }, ensure_ascii=False),
        operator=operator,
        conclusion=f"状态从 {old_status} 变更为 {target_status}"
    )
    db.add(exception_record)
    db.commit()
    db.refresh(order)
    return order


def create_outsourcing(db: Session, data: schemas.OutsourcingCreate) -> Outsourcing:
    order = db.query(RepairOrder).filter(RepairOrder.id == data.repair_order_id).first()
    if not order:
        raise ValueError("Repair order not found")
    
    existing = db.query(Outsourcing).filter(Outsourcing.repair_order_id == data.repair_order_id).first()
    if existing:
        raise ValueError("Outsourcing record already exists")
    
    outsourcing = Outsourcing(
        repair_order_id=data.repair_order_id,
        outsourcer_name=data.outsourcer_name,
        outsourcer_contact=data.outsourcer_contact,
        promised_completion_time=data.promised_completion_time,
        cost=data.cost,
        remarks=data.remarks
    )
    db.add(outsourcing)
    
    if order.status == RepairOrderStatus.PROCESSING:
        order.status = RepairOrderStatus.OUTSOURCED
    
    db.commit()
    db.refresh(outsourcing)
    return outsourcing


def create_completion_proof(db: Session, data: schemas.CompletionProofCreate) -> CompletionProof:
    order = db.query(RepairOrder).filter(RepairOrder.id == data.repair_order_id).first()
    if not order:
        raise ValueError("Repair order not found")
    
    existing = db.query(CompletionProof).filter(CompletionProof.repair_order_id == data.repair_order_id).first()
    if existing:
        raise ValueError("Completion proof already exists")
    
    proof = CompletionProof(
        repair_order_id=data.repair_order_id,
        proof_type=data.proof_type,
        proof_content=data.proof_content,
        image_urls=data.image_urls,
        submitter=data.submitter
    )
    db.add(proof)
    db.commit()
    db.refresh(proof)
    return proof


def verify_completion_proof(db: Session, proof_id: int, data: schemas.CompletionProofVerify) -> CompletionProof:
    proof = db.query(CompletionProof).filter(CompletionProof.id == proof_id).first()
    if not proof:
        raise ValueError("Completion proof not found")
    
    proof.verifier = data.verifier
    proof.verify_time = datetime.utcnow()
    proof.is_verified = data.is_verified
    proof.verify_remarks = data.verify_remarks
    
    if data.is_verified:
        order = db.query(RepairOrder).filter(RepairOrder.id == proof.repair_order_id).first()
        if order and order.status == RepairOrderStatus.COMPLETED:
            order.status = RepairOrderStatus.VERIFIED
    
    db.commit()
    db.refresh(proof)
    return proof


def manual_correction(db: Session, order_id: int, data: schemas.ManualCorrection) -> RepairOrder:
    order = db.query(RepairOrder).filter(RepairOrder.id == order_id).first()
    if not order:
        raise ValueError("Repair order not found")
    
    if not hasattr(order, data.field_name):
        raise ValueError(f"Field {data.field_name} does not exist")
    
    setattr(order, data.field_name, data.new_value)
    
    exception_record = ExceptionRecord(
        repair_order_id=order_id,
        operation_type="manual_correction",
        original_input=json.dumps({
            "field_name": data.field_name,
            "old_value": data.old_value,
            "new_value": data.new_value,
            "reason": data.reason
        }, ensure_ascii=False),
        operator=data.operator,
        conclusion=f"人工修正字段 {data.field_name}: {data.old_value} -> {data.new_value}"
    )
    db.add(exception_record)
    db.commit()
    db.refresh(order)
    return order


def close_or_cancel_order(db: Session, order_id: int, operator: str, is_cancel: bool = False, reason: str = "") -> RepairOrder:
    order = db.query(RepairOrder).filter(RepairOrder.id == order_id).first()
    if not order:
        raise ValueError("Repair order not found")
    
    target_status = RepairOrderStatus.CANCELLED if is_cancel else RepairOrderStatus.CLOSED
    
    order.status = target_status
    order.closed_at = datetime.utcnow()
    
    exception_record = ExceptionRecord(
        repair_order_id=order_id,
        operation_type="close_or_cancel",
        original_input=json.dumps({
            "action": "cancel" if is_cancel else "close",
            "reason": reason
        }, ensure_ascii=False),
        operator=operator,
        conclusion=f"{'撤回' if is_cancel else '关闭'}报修单"
    )
    db.add(exception_record)
    db.commit()
    db.refresh(order)
    return order


def get_statistics(db: Session) -> dict:
    total = db.query(RepairOrder).count()
    timeout_count = db.query(RepairOrder).filter(RepairOrder.is_timeout == True).count()
    duplicated_count = db.query(RepairOrder).filter(RepairOrder.is_duplicated == True).count()
    outsourced_count = db.query(Outsourcing).count()
    verified_count = db.query(RepairOrder).filter(RepairOrder.status == RepairOrderStatus.VERIFIED).count()
    
    status_counts = {}
    for status in RepairOrderStatus:
        count = db.query(RepairOrder).filter(RepairOrder.status == status).count()
        status_counts[str(status)] = count
    
    return {
        "total_orders": total,
        "timeout_orders": timeout_count,
        "duplicated_orders": duplicated_count,
        "outsourced_orders": outsourced_count,
        "verified_orders": verified_count,
        "status_distribution": status_counts
    }
