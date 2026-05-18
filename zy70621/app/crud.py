from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from typing import Optional, List
from app import models, schemas
from app.rules import RuleEngine, OrderStatus
import uuid


def generate_order_no() -> str:
    return f"WO{datetime.now().strftime('%Y%m%d%H%M')}{uuid.uuid4().hex[:4].upper()}"


def generate_outsource_order_no() -> str:
    return f"OS{datetime.now().strftime('%Y%m%d%H%M')}{uuid.uuid4().hex[:4].upper()}"


def get_building_room(db: Session, building: str, room_number: str) -> Optional[models.BuildingRoom]:
    return db.query(models.BuildingRoom).filter(
        and_(models.BuildingRoom.building == building, models.BuildingRoom.room_number == room_number)
    ).first()


def create_building_room(db: Session, building: str, room_number: str, owner_name: Optional[str] = None, owner_phone: Optional[str] = None) -> models.BuildingRoom:
    db_room = models.BuildingRoom(
        building=building,
        room_number=room_number,
        owner_name=owner_name,
        owner_phone=owner_phone
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room


def get_handler(db: Session, handler_id: int) -> Optional[models.Handler]:
    return db.query(models.Handler).filter(models.Handler.id == handler_id).first()


def create_handler(db: Session, handler: schemas.HandlerCreate) -> models.Handler:
    db_handler = models.Handler(**handler.model_dump())
    db.add(db_handler)
    db.commit()
    db.refresh(db_handler)
    return db_handler


def get_repair_order(db: Session, order_id: int) -> Optional[models.RepairOrder]:
    return db.query(models.RepairOrder).filter(models.RepairOrder.id == order_id).first()


def get_repair_order_by_no(db: Session, order_no: str) -> Optional[models.RepairOrder]:
    return db.query(models.RepairOrder).filter(models.RepairOrder.order_no == order_no).first()


def create_repair_order(db: Session, order: schemas.RepairOrderCreate) -> models.RepairOrder:
    building_room = get_building_room(db, order.building, order.room_number)
    if not building_room:
        building_room = create_building_room(db, order.building, order.room_number)
    
    reported_at = datetime.now()
    expected_completion = RuleEngine.calculate_expected_completion(reported_at, order.sla_hours)
    
    db_order = models.RepairOrder(
        order_no=generate_order_no(),
        building_room_id=building_room.id,
        repair_type=order.repair_type,
        description=order.description,
        contact_name=order.contact_name,
        contact_phone=order.contact_phone,
        priority=order.priority,
        sla_hours=order.sla_hours,
        reported_at=reported_at,
        expected_completion_at=expected_completion
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    log = models.StatusLog(
        repair_order_id=db_order.id,
        from_status=None,
        to_status=OrderStatus.PENDING,
        operated_by="system",
        operation_type="create",
        notes="工单创建",
        conclusion=f"工单 {db_order.order_no} 创建成功，预计完成时间 {expected_completion.strftime('%Y-%m-%d %H:%M')}"
    )
    db.add(log)
    db.commit()
    
    return db_order


def query_repair_orders(db: Session, query: schemas.RepairOrderQuery) -> tuple[List[models.RepairOrder], int]:
    q = db.query(models.RepairOrder).join(models.BuildingRoom)
    
    if query.status:
        q = q.filter(models.RepairOrder.status == query.status)
    if query.building:
        q = q.filter(models.BuildingRoom.building == query.building)
    if query.room_number:
        q = q.filter(models.BuildingRoom.room_number == query.room_number)
    if query.repair_type:
        q = q.filter(models.RepairOrder.repair_type == query.repair_type)
    if query.is_overdue is not None:
        q = q.filter(models.RepairOrder.is_overdue == query.is_overdue)
    if query.is_merged is not None:
        q = q.filter(models.RepairOrder.is_merged == query.is_merged)
    if query.handler_id:
        q = q.filter(models.RepairOrder.handler_id == query.handler_id)
    if query.start_date:
        q = q.filter(models.RepairOrder.reported_at >= query.start_date)
    if query.end_date:
        q = q.filter(models.RepairOrder.reported_at <= query.end_date)
    
    total = q.count()
    
    orders = q.order_by(models.RepairOrder.created_at.desc()).offset((query.page - 1) * query.page_size).limit(query.page_size).all()
    
    return orders, total


def add_reminder(db: Session, order_id: int, reminder: schemas.ReminderCreate) -> models.Reminder:
    duplicate = RuleEngine.check_duplicate_reminder(db, order_id, reminder.content)
    
    db_reminder = models.Reminder(
        repair_order_id=order_id,
        reminder_type=reminder.reminder_type,
        content=reminder.content,
        reminded_by=reminder.reminded_by,
        is_duplicate=duplicate is not None,
        duplicate_of_reminder_id=duplicate.id if duplicate else None
    )
    db.add(db_reminder)
    
    order = get_repair_order(db, order_id)
    order.reminder_count += 1
    RuleEngine.update_overdue_status(db, order)
    
    db.commit()
    db.refresh(db_reminder)
    return db_reminder


def advance_status(db: Session, order_id: int, transition: str, request: schemas.StatusAdvanceRequest) -> Optional[models.RepairOrder]:
    order = get_repair_order(db, order_id)
    if not order:
        return None
    
    next_status = RuleEngine.get_next_status(order.status, transition)
    if not next_status:
        return None
    
    old_status = order.status
    order.status = next_status
    
    if request.handler_id:
        order.handler_id = request.handler_id
    
    if next_status == OrderStatus.COMPLETED:
        order.completed_at = datetime.now()
    
    log = models.StatusLog(
        repair_order_id=order.id,
        from_status=old_status,
        to_status=next_status,
        operated_by=request.operated_by,
        operation_type=transition,
        notes=request.notes,
        original_request=request.original_request,
        conclusion=request.conclusion or f"状态从 {old_status} -> {next_status}"
    )
    db.add(log)
    
    RuleEngine.update_overdue_status(db, order)
    db.commit()
    db.refresh(order)
    return order


def manual_correction(db: Session, order_id: int, request: schemas.ManualCorrectionRequest) -> Optional[models.RepairOrder]:
    order = get_repair_order(db, order_id)
    if not order:
        return None
    
    old_status = order.status
    order.status = request.new_status
    
    log = models.StatusLog(
        repair_order_id=order.id,
        from_status=old_status,
        to_status=request.new_status,
        operated_by=request.operated_by,
        operation_type="manual_correction",
        notes=request.notes,
        original_request=request.original_request,
        conclusion=request.conclusion or f"人工修正状态: {old_status} -> {request.new_status}"
    )
    db.add(log)
    
    db.commit()
    db.refresh(order)
    return order


def close_order(db: Session, order_id: int, request: schemas.CloseOrderRequest) -> Optional[models.RepairOrder]:
    order = get_repair_order(db, order_id)
    if not order:
        return None
    
    old_status = order.status
    order.status = OrderStatus.CANCELLED
    
    log = models.StatusLog(
        repair_order_id=order.id,
        from_status=old_status,
        to_status=OrderStatus.CANCELLED,
        operated_by=request.operated_by,
        operation_type="close",
        notes=request.reason,
        original_request=request.original_request,
        conclusion=request.conclusion or f"工单已关闭，原因: {request.reason}"
    )
    db.add(log)
    
    db.commit()
    db.refresh(order)
    return order


def create_outsource_order(db: Session, order_id: int, outsource_data: schemas.OutsourceOrderCreate, operated_by: str) -> Optional[models.OutsourceOrder]:
    order = get_repair_order(db, order_id)
    if not order:
        return None
    
    if order.outsource_order:
        return None
    
    db_outsource = models.OutsourceOrder(
        repair_order_id=order_id,
        outsource_company_id=outsource_data.outsource_company_id,
        outsource_order_no=generate_outsource_order_no(),
        estimated_cost=outsource_data.estimated_cost,
        notes=outsource_data.notes
    )
    db.add(db_outsource)
    
    old_status = order.status
    order.status = OrderStatus.OUTSOURCED
    
    log = models.StatusLog(
        repair_order_id=order.id,
        from_status=old_status,
        to_status=OrderStatus.OUTSOURCED,
        operated_by=operated_by,
        operation_type="outsource",
        notes=f"外包给处理人ID: {outsource_data.outsource_company_id}",
        conclusion=f"已转外包，外包单号: {db_outsource.outsource_order_no}"
    )
    db.add(log)
    
    db.commit()
    db.refresh(db_outsource)
    return db_outsource


def create_completion_proof(db: Session, order_id: int, proof_data: schemas.CompletionProofCreate) -> Optional[models.CompletionProof]:
    order = get_repair_order(db, order_id)
    if not order:
        return None
    
    if order.completion_proof:
        return None
    
    db_proof = models.CompletionProof(
        repair_order_id=order_id,
        proof_type=proof_data.proof_type,
        proof_url=proof_data.proof_url,
        description=proof_data.description
    )
    db.add(db_proof)
    db.commit()
    db.refresh(db_proof)
    return db_proof


def verify_completion(db: Session, order_id: int, request: schemas.VerifyCompletionRequest) -> Optional[models.CompletionProof]:
    order = get_repair_order(db, order_id)
    if not order or not order.completion_proof:
        return None
    
    proof = order.completion_proof
    proof.is_verified = request.is_verified
    proof.verified_by = request.verified_by
    proof.verified_at = datetime.now()
    proof.verification_notes = request.verification_notes
    
    if request.is_verified:
        order.status = OrderStatus.VERIFIED
        log = models.StatusLog(
            repair_order_id=order.id,
            from_status=OrderStatus.COMPLETED,
            to_status=OrderStatus.VERIFIED,
            operated_by=request.verified_by,
            operation_type="verify",
            notes=request.verification_notes,
            conclusion="完工验证通过"
        )
        db.add(log)
    
    db.commit()
    db.refresh(proof)
    return proof