from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from . import models, schemas
from .schemas import can_transition, STATUS_TRANSITIONS

def generate_order_no(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"R{today}"
    from sqlalchemy import func
    count = db.query(func.count(models.RepairOrder.id)).filter(
        models.RepairOrder.order_no.like(f"{prefix}%")
    ).scalar()
    return f"{prefix}{count + 1:04d}"

def check_technician_conflict(
    db: Session,
    technician_id: int,
    appointment_time: datetime,
    exclude_order_id: Optional[int] = None,
    duration_minutes: int = 60
) -> bool:
    if not appointment_time or not technician_id:
        return False
    
    end_time = appointment_time + timedelta(minutes=duration_minutes)
    
    query = db.query(models.RepairOrder).filter(
        models.RepairOrder.technician_id == technician_id,
        models.RepairOrder.appointment_time.isnot(None),
        models.RepairOrder.status.notin_(["已完成", "已取消"])
    )
    
    if exclude_order_id:
        query = query.filter(models.RepairOrder.id != exclude_order_id)
    
    orders = query.all()
    
    for order in orders:
        order_start = order.appointment_time
        order_end = order_start + timedelta(minutes=duration_minutes)
        
        if appointment_time < order_end and end_time > order_start:
            return True
    
    return False

def create_technician(db: Session, technician: schemas.TechnicianCreate) -> models.Technician:
    db_technician = models.Technician(**technician.model_dump())
    db.add(db_technician)
    db.commit()
    db.refresh(db_technician)
    return db_technician

def get_technicians(db: Session, skip: int = 0, limit: int = 100, active_only: bool = False) -> List[models.Technician]:
    query = db.query(models.Technician)
    if active_only:
        query = query.filter(models.Technician.is_active == True)
    return query.offset(skip).limit(limit).all()

def get_technician(db: Session, technician_id: int) -> Optional[models.Technician]:
    return db.query(models.Technician).filter(models.Technician.id == technician_id).first()

def update_technician(db: Session, technician_id: int, technician: schemas.TechnicianUpdate) -> Optional[models.Technician]:
    db_technician = get_technician(db, technician_id)
    if not db_technician:
        return None
    
    update_data = technician.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_technician, key, value)
    
    db.commit()
    db.refresh(db_technician)
    return db_technician

def create_spare_part(db: Session, spare_part: schemas.SparePartCreate) -> models.SparePart:
    db_spare_part = models.SparePart(**spare_part.model_dump())
    db.add(db_spare_part)
    db.commit()
    db.refresh(db_spare_part)
    return db_spare_part

def get_spare_parts(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    low_stock_only: bool = False,
    category: Optional[str] = None
) -> List[models.SparePart]:
    query = db.query(models.SparePart)
    
    if low_stock_only:
        query = query.filter(models.SparePart.stock_quantity <= models.SparePart.min_stock)
    
    if category:
        query = query.filter(models.SparePart.category == category)
    
    return query.offset(skip).limit(limit).all()

def get_spare_part(db: Session, spare_part_id: int) -> Optional[models.SparePart]:
    return db.query(models.SparePart).filter(models.SparePart.id == spare_part_id).first()

def get_spare_part_by_sku(db: Session, sku: str) -> Optional[models.SparePart]:
    return db.query(models.SparePart).filter(models.SparePart.sku == sku).first()

def update_spare_part(db: Session, spare_part_id: int, spare_part: schemas.SparePartUpdate) -> Optional[models.SparePart]:
    db_spare_part = get_spare_part(db, spare_part_id)
    if not db_spare_part:
        return None
    
    update_data = spare_part.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_spare_part, key, value)
    
    db.commit()
    db.refresh(db_spare_part)
    return db_spare_part

def adjust_spare_part_stock(
    db: Session, 
    spare_part_id: int, 
    quantity: int, 
    notes: Optional[str] = None,
    repair_order_id: Optional[int] = None
) -> Optional[models.SparePart]:
    db_spare_part = get_spare_part(db, spare_part_id)
    if not db_spare_part:
        return None
    
    new_stock = db_spare_part.stock_quantity + quantity
    if new_stock < 0:
        return None
    
    db_spare_part.stock_quantity = new_stock
    
    transaction = models.InventoryTransaction(
        spare_part_id=spare_part_id,
        repair_order_id=repair_order_id,
        transaction_type="入库" if quantity > 0 else "出库",
        quantity=abs(quantity),
        unit_price=db_spare_part.unit_price,
        notes=notes
    )
    db.add(transaction)
    
    db.commit()
    db.refresh(db_spare_part)
    return db_spare_part

def create_repair_order(db: Session, order: schemas.RepairOrderCreate) -> Tuple[Optional[models.RepairOrder], Optional[str]]:
    if order.technician_id and order.appointment_time:
        if check_technician_conflict(db, order.technician_id, order.appointment_time):
            return None, "该技师在预约时间已有安排，请选择其他时间或技师"
    
    order_no = generate_order_no(db)
    
    db_order = models.RepairOrder(
        order_no=order_no,
        **order.model_dump(exclude={"order_no"}),
        status=schemas.OrderStatus.PENDING_CONFIRM.value
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    history = models.StatusHistory(
        repair_order_id=db_order.id,
        from_status=None,
        to_status=schemas.OrderStatus.PENDING_CONFIRM.value,
        reason="新建维修单"
    )
    db.add(history)
    db.commit()
    
    return db_order, None

def get_repair_orders(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    technician_id: Optional[int] = None,
    customer_name: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[models.RepairOrder]:
    query = db.query(models.RepairOrder)
    
    if status:
        query = query.filter(models.RepairOrder.status == status)
    
    if technician_id:
        query = query.filter(models.RepairOrder.technician_id == technician_id)
    
    if customer_name:
        query = query.filter(models.RepairOrder.customer_name.contains(customer_name))
    
    if start_date:
        query = query.filter(models.RepairOrder.created_at >= start_date)
    
    if end_date:
        query = query.filter(models.RepairOrder.created_at < end_date + timedelta(days=1))
    
    return query.order_by(models.RepairOrder.created_at.desc()).offset(skip).limit(limit).all()

def get_repair_order(db: Session, order_id: int) -> Optional[models.RepairOrder]:
    return db.query(models.RepairOrder).filter(models.RepairOrder.id == order_id).first()

def get_repair_order_by_no(db: Session, order_no: str) -> Optional[models.RepairOrder]:
    return db.query(models.RepairOrder).filter(models.RepairOrder.order_no == order_no).first()

def update_repair_order(
    db: Session, 
    order_id: int, 
    order: schemas.RepairOrderUpdate
) -> Tuple[Optional[models.RepairOrder], Optional[str]]:
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None, "维修单不存在"
    
    update_data = order.model_dump(exclude_unset=True)
    
    if "technician_id" in update_data or "appointment_time" in update_data:
        tech_id = update_data.get("technician_id") or db_order.technician_id
        appt_time = update_data.get("appointment_time") or db_order.appointment_time
        
        if tech_id and appt_time:
            if check_technician_conflict(db, tech_id, appt_time, exclude_order_id=order_id):
                return None, "该技师在预约时间已有安排"
    
    for key, value in update_data.items():
        setattr(db_order, key, value)
    
    db.commit()
    db.refresh(db_order)
    return db_order, None

def update_order_status(
    db: Session,
    order_id: int,
    new_status: schemas.OrderStatus,
    reason: Optional[str] = None
) -> Tuple[Optional[models.RepairOrder], Optional[str]]:
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None, "维修单不存在"
    
    if not can_transition(db_order.status, new_status.value):
        return None, f"无法从 {db_order.status} 转换为 {new_status.value}，有效的转换是: {STATUS_TRANSITIONS.get(db_order.status, [])}"
    
    old_status = db_order.status
    db_order.status = new_status.value
    
    now = datetime.utcnow()
    if new_status == schemas.OrderStatus.IN_PROGRESS:
        db_order.start_repair_time = now
    elif new_status == schemas.OrderStatus.COMPLETED:
        db_order.complete_time = now
        if db_order.final_cost == 0:
            db_order.final_cost = db_order.estimated_cost
    
    history = models.StatusHistory(
        repair_order_id=order_id,
        from_status=old_status,
        to_status=new_status.value,
        reason=reason
    )
    db.add(history)
    db.commit()
    db.refresh(db_order)
    return db_order, None

def adjust_order_cost(
    db: Session,
    order_id: int,
    cost_adjust: schemas.CostAdjustment
) -> Tuple[Optional[models.RepairOrder], Optional[str]]:
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None, "维修单不存在"
    
    update_data = cost_adjust.model_dump(exclude_unset=True, exclude={"reason"})
    for key, value in update_data.items():
        setattr(db_order, key, value)
    
    if cost_adjust.reason:
        log = models.CommunicationLog(
            repair_order_id=order_id,
            content=f"费用调整: {cost_adjust.reason}"
        )
        db.add(log)
    
    db.commit()
    db.refresh(db_order)
    return db_order, None

def mark_order_paid(
    db: Session,
    order_id: int
) -> Tuple[Optional[models.RepairOrder], Optional[str]]:
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None, "维修单不存在"
    
    if db_order.status != schemas.OrderStatus.COMPLETED.value:
        return None, "只有已完成的订单才能标记为已收款"
    
    if db_order.is_paid:
        return None, "该订单已经收款"
    
    db_order.is_paid = True
    db_order.paid_at = datetime.utcnow()
    
    log = models.CommunicationLog(
        repair_order_id=order_id,
        content=f"已收款: {db_order.final_cost - db_order.discount} 元"
    )
    db.add(log)
    
    db.commit()
    db.refresh(db_order)
    return db_order, None

def consume_spare_parts(
    db: Session,
    order_id: int,
    items: List[schemas.SparePartConsume]
) -> Tuple[bool, List[str]]:
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return False, ["维修单不存在"]
    
    if db_order.status not in ["维修中", "待取件"]:
        return False, ["只有维修中或待取件的订单才能消耗备件"]
    
    errors = []
    valid_items = []
    
    for item in items:
        spare_part = get_spare_part(db, item.spare_part_id)
        if not spare_part:
            errors.append(f"备件 ID {item.spare_part_id} 不存在")
            continue
        
        if spare_part.stock_quantity < item.quantity:
            errors.append(f"备件 '{spare_part.name}' 库存不足 (当前库存: {spare_part.stock_quantity}, 需要: {item.quantity})")
            continue
        
        valid_items.append((spare_part, item.quantity))
    
    if errors:
        return False, errors
    
    for spare_part, quantity in valid_items:
        spare_part.stock_quantity -= quantity
        
        transaction = models.InventoryTransaction(
            spare_part_id=spare_part.id,
            repair_order_id=order_id,
            transaction_type="出库",
            quantity=quantity,
            unit_price=spare_part.unit_price
        )
        db.add(transaction)
    
    db.commit()
    return True, []

def add_communication_log(
    db: Session,
    order_id: int,
    log: schemas.CommunicationLogCreate
) -> Optional[models.CommunicationLog]:
    db_order = get_repair_order(db, order_id)
    if not db_order:
        return None
    
    db_log = models.CommunicationLog(
        repair_order_id=order_id,
        **log.model_dump()
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_technician_schedule(
    db: Session,
    technician_id: int,
    date: datetime
) -> List[models.RepairOrder]:
    start_of_day = datetime(date.year, date.month, date.day, 0, 0, 0)
    end_of_day = datetime(date.year, date.month, date.day, 23, 59, 59)
    
    return db.query(models.RepairOrder).filter(
        models.RepairOrder.technician_id == technician_id,
        models.RepairOrder.appointment_time >= start_of_day,
        models.RepairOrder.appointment_time <= end_of_day,
        models.RepairOrder.status.notin_(["已完成", "已取消"])
    ).order_by(models.RepairOrder.appointment_time).all()

def get_dashboard_stats(db: Session) -> schemas.DashboardStats:
    today = datetime.utcnow().date()
    start_of_today = datetime(today.year, today.month, today.day, 0, 0, 0)
    end_of_today = datetime(today.year, today.month, today.day, 23, 59, 59)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    today_appointments = db.query(models.RepairOrder).filter(
        models.RepairOrder.appointment_time >= start_of_today,
        models.RepairOrder.appointment_time <= end_of_today,
        models.RepairOrder.status.notin_(["已完成", "已取消"])
    ).count()
    
    overdue_orders = db.query(models.RepairOrder).filter(
        models.RepairOrder.appointment_time < start_of_today,
        models.RepairOrder.status.notin_(["已完成", "已取消"])
    ).count()
    
    low_stock_items = db.query(models.SparePart).filter(
        models.SparePart.stock_quantity <= models.SparePart.min_stock
    ).count()
    
    last_7_days_income = db.query(models.RepairOrder).filter(
        models.RepairOrder.status == "已完成",
        models.RepairOrder.complete_time >= seven_days_ago
    ).all()
    
    total_income = sum(
        order.final_cost - order.discount 
        for order in last_7_days_income 
        if order.final_cost is not None
    )
    
    return schemas.DashboardStats(
        today_appointments=today_appointments,
        overdue_orders=overdue_orders,
        low_stock_items=low_stock_items,
        last_7_days_income=total_income
    )
