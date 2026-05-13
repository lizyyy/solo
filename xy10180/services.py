from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple
import uuid

from models import (
    Device, MaintenanceRule, MaintenanceOrder, OrderPart, 
    MaintenanceHistory, Inventory, RulePart,
    MaintenanceStatus, RuleType
)
from schemas import (
    DeviceCreate, DeviceUpdate, MaintenanceRuleCreate,
    CheckMaintenanceRequest, TriggerMaintenanceRequest,
    UpdateOrderStatusRequest, DelayOrderRequest,
    InventoryCreate
)


def create_device(db: Session, data: DeviceCreate) -> Device:
    device = Device(**data.model_dump())
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def get_device(db: Session, device_id: int) -> Optional[Device]:
    return db.query(Device).filter(Device.id == device_id).first()


def get_all_devices(db: Session) -> List[Device]:
    return db.query(Device).all()


def update_device(db: Session, device_id: int, data: DeviceUpdate) -> Optional[Device]:
    device = get_device(db, device_id)
    if not device:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(device, key, value)
    db.commit()
    db.refresh(device)
    return device


def create_maintenance_rule(db: Session, data: MaintenanceRuleCreate) -> MaintenanceRule:
    device = get_device(db, data.device_id)
    if not device:
        raise ValueError(f"设备 ID {data.device_id} 不存在")
    
    rule_data = data.model_dump(exclude={"parts"})
    rule = MaintenanceRule(**rule_data)
    db.add(rule)
    db.flush()
    
    if data.parts:
        for part in data.parts:
            db.add(RulePart(rule_id=rule.id, **part.model_dump()))
    
    db.commit()
    db.refresh(rule)
    return rule


def get_rules_by_device(db: Session, device_id: int) -> List[MaintenanceRule]:
    return db.query(MaintenanceRule).filter(
        MaintenanceRule.device_id == device_id,
        MaintenanceRule.is_active == 1
    ).all()


def get_all_rules(db: Session) -> List[MaintenanceRule]:
    return db.query(MaintenanceRule).all()


def check_maintenance_triggered(
    db: Session, 
    device: Device, 
    rule: MaintenanceRule,
    current_value: float
) -> bool:
    last_order = db.query(MaintenanceOrder).filter(
        MaintenanceOrder.device_id == device.id,
        MaintenanceOrder.rule_id == rule.id,
        MaintenanceOrder.status.in_([
            MaintenanceStatus.PENDING,
            MaintenanceStatus.IN_PROGRESS,
            MaintenanceStatus.DELAYED
        ])
    ).first()
    
    if last_order:
        return False
    
    if rule.rule_type == RuleType.HOURS:
        return current_value >= rule.threshold_value
    elif rule.rule_type == RuleType.COUNT:
        return current_value >= rule.threshold_value
    elif rule.rule_type == RuleType.DATE:
        today = date.today()
        rule_date = date.fromtimestamp(rule.threshold_value)
        return today >= rule_date
    
    return False


def get_last_maintenance_value(
    db: Session, 
    device_id: int, 
    rule_type: RuleType
) -> float:
    order = db.query(MaintenanceOrder).filter(
        MaintenanceOrder.device_id == device_id,
        MaintenanceOrder.trigger_type == rule_type,
        MaintenanceOrder.status == MaintenanceStatus.COMPLETED
    ).order_by(MaintenanceOrder.completed_at.desc()).first()
    
    if order:
        return order.trigger_value
    return 0.0


def get_last_completed_date(
    db: Session,
    device_id: int,
    rule_type: RuleType
) -> Optional[date]:
    order = db.query(MaintenanceOrder).filter(
        MaintenanceOrder.device_id == device_id,
        MaintenanceOrder.trigger_type == rule_type,
        MaintenanceOrder.status == MaintenanceStatus.COMPLETED
    ).order_by(MaintenanceOrder.completed_at.desc()).first()
    
    if order and order.completed_at:
        return order.completed_at.date()
    return None


def check_device_maintenance(
    db: Session, 
    request: CheckMaintenanceRequest
) -> dict:
    device = get_device(db, request.device_id)
    if not device:
        raise ValueError(f"设备 ID {request.device_id} 不存在")
    
    rules = get_rules_by_device(db, request.device_id)
    triggered = []
    
    current_hours = request.current_hours if request.current_hours is not None else device.total_hours
    current_count = request.current_count if request.current_count is not None else device.total_count
    check_date = request.check_date or date.today()
    
    for rule in rules:
        if rule.rule_type == RuleType.HOURS:
            last_value = get_last_maintenance_value(db, device.id, rule.rule_type)
            effective_threshold = last_value + rule.threshold_value
            is_triggered = current_hours >= effective_threshold
            if is_triggered:
                triggered.append({
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "rule_type": rule.rule_type.value,
                    "threshold": effective_threshold,
                    "current_value": current_hours
                })
        elif rule.rule_type == RuleType.COUNT:
            last_value = get_last_maintenance_value(db, device.id, rule.rule_type)
            effective_threshold = last_value + rule.threshold_value
            is_triggered = current_count >= effective_threshold
            if is_triggered:
                triggered.append({
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "rule_type": rule.rule_type.value,
                    "threshold": effective_threshold,
                    "current_value": current_count
                })
        elif rule.rule_type == RuleType.DATE:
            last_completed = get_last_completed_date(db, device.id, rule.rule_type)
            
            interval_days = int(rule.threshold_value)
            if last_completed:
                next_due_date = last_completed + timedelta(days=interval_days)
            else:
                next_due_date = rule.created_at.date() + timedelta(days=interval_days)
            
            is_triggered = check_date >= next_due_date
            if is_triggered:
                triggered.append({
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "rule_type": rule.rule_type.value,
                    "threshold_date": next_due_date.isoformat(),
                    "current_date": check_date.isoformat(),
                    "interval_days": interval_days
                })
    
    return {
        "device_id": device.id,
        "device_name": device.name,
        "triggered_rules": triggered,
        "has_triggered": len(triggered) > 0
    }


def generate_idempotent_key(device_id: int, rule_id: int, trigger_value: float) -> str:
    return f"order_{device_id}_{rule_id}_{int(trigger_value)}"


def generate_order_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_str = str(uuid.uuid4())[:6].upper()
    return f"MO-{timestamp}-{random_str}"


def check_inventory_available(db: Session, rule_parts: List[RulePart]) -> Tuple[bool, List[dict]]:
    available = True
    results = []
    
    for rule_part in rule_parts:
        if rule_part.part_code:
            inventory = db.query(Inventory).filter(
                Inventory.part_code == rule_part.part_code
            ).first()
            
            if inventory:
                avail = inventory.total_quantity - inventory.reserved_quantity
                has_enough = avail >= rule_part.quantity
                if not has_enough:
                    available = False
                results.append({
                    "part_code": rule_part.part_code,
                    "part_name": rule_part.part_name,
                    "required": rule_part.quantity,
                    "available": avail,
                    "has_enough": has_enough
                })
            else:
                available = False
                results.append({
                    "part_code": rule_part.part_code,
                    "part_name": rule_part.part_name,
                    "required": rule_part.quantity,
                    "available": 0,
                    "has_enough": False
                })
        else:
            results.append({
                "part_code": None,
                "part_name": rule_part.part_name,
                "required": rule_part.quantity,
                "available": None,
                "has_enough": True
            })
    
    return available, results


def reserve_parts(db: Session, order_id: int, rule_parts: List[RulePart]):
    for rule_part in rule_parts:
        order_part = OrderPart(
            order_id=order_id,
            part_name=rule_part.part_name,
            part_code=rule_part.part_code,
            quantity=rule_part.quantity,
            is_reserved=1
        )
        db.add(order_part)
        
        if rule_part.part_code:
            inventory = db.query(Inventory).filter(
                Inventory.part_code == rule_part.part_code
            ).first()
            if inventory:
                inventory.reserved_quantity += rule_part.quantity


def add_history(
    db: Session,
    order_id: int,
    device_id: int,
    action: str,
    from_status: Optional[MaintenanceStatus] = None,
    to_status: Optional[MaintenanceStatus] = None,
    note: Optional[str] = None
):
    history = MaintenanceHistory(
        order_id=order_id,
        device_id=device_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        note=note
    )
    db.add(history)


def create_maintenance_order(
    db: Session, 
    request: TriggerMaintenanceRequest
) -> MaintenanceOrder:
    device = get_device(db, request.device_id)
    if not device:
        raise ValueError(f"设备 ID {request.device_id} 不存在")
    
    rule = db.query(MaintenanceRule).filter(
        MaintenanceRule.id == request.rule_id,
        MaintenanceRule.device_id == request.device_id,
        MaintenanceRule.is_active == 1
    ).first()
    if not rule:
        raise ValueError(f"规则 ID {request.rule_id} 不存在或已失效")
    
    idempotent_key = generate_idempotent_key(
        request.device_id, 
        request.rule_id, 
        request.trigger_value
    )
    
    existing_order = db.query(MaintenanceOrder).filter(
        MaintenanceOrder.idempotent_key == idempotent_key
    ).first()
    
    if existing_order:
        return existing_order
    
    unfinished_order = db.query(MaintenanceOrder).filter(
        MaintenanceOrder.device_id == request.device_id,
        MaintenanceOrder.rule_id == request.rule_id,
        MaintenanceOrder.status.in_([
            MaintenanceStatus.PENDING,
            MaintenanceStatus.IN_PROGRESS,
            MaintenanceStatus.DELAYED
        ])
    ).first()
    
    if unfinished_order:
        return unfinished_order
    
    if rule.parts:
        has_inventory, inventory_check = check_inventory_available(db, rule.parts)
        if not has_inventory:
            shortage = [x for x in inventory_check if not x["has_enough"]]
            raise ValueError(f"配件库存不足: {shortage}")
    
    due_date = request.due_date or (date.today() + timedelta(days=7))
    
    order = MaintenanceOrder(
        device_id=request.device_id,
        rule_id=request.rule_id,
        order_no=generate_order_no(),
        idempotent_key=idempotent_key,
        trigger_type=rule.rule_type,
        trigger_value=request.trigger_value,
        scheduled_date=date.today(),
        due_date=due_date,
        original_due_date=due_date,
        status=MaintenanceStatus.PENDING,
        description=request.description or rule.description
    )
    db.add(order)
    db.flush()
    
    if rule.parts:
        reserve_parts(db, order.id, rule.parts)
    
    add_history(
        db, order.id, request.device_id,
        action="CREATE",
        to_status=MaintenanceStatus.PENDING,
        note=f"根据规则 {rule.name} 创建设备保养工单"
    )
    
    db.commit()
    db.refresh(order)
    return order


def get_order(db: Session, order_id: int) -> Optional[MaintenanceOrder]:
    return db.query(MaintenanceOrder).filter(MaintenanceOrder.id == order_id).first()


def get_orders_by_device(db: Session, device_id: int) -> List[MaintenanceOrder]:
    return db.query(MaintenanceOrder).filter(
        MaintenanceOrder.device_id == device_id
    ).order_by(MaintenanceOrder.created_at.desc()).all()


def get_all_orders(db: Session) -> List[MaintenanceOrder]:
    return db.query(MaintenanceOrder).order_by(MaintenanceOrder.created_at.desc()).all()


VALID_STATUS_TRANSITIONS = {
    MaintenanceStatus.PENDING: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.DELAYED, MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
    MaintenanceStatus.DELAYED: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
    MaintenanceStatus.IN_PROGRESS: [MaintenanceStatus.COMPLETED, MaintenanceStatus.DELAYED, MaintenanceStatus.CANCELLED],
    MaintenanceStatus.COMPLETED: [],
    MaintenanceStatus.CANCELLED: [],
}


def is_valid_status_transition(from_status: MaintenanceStatus, to_status: MaintenanceStatus) -> bool:
    return to_status in VALID_STATUS_TRANSITIONS.get(from_status, [])


def update_order_status(
    db: Session, 
    order_id: int, 
    request: UpdateOrderStatusRequest
) -> MaintenanceOrder:
    order = get_order(db, order_id)
    if not order:
        raise ValueError(f"工单 ID {order_id} 不存在")
    
    if order.status == request.status:
        return order
    
    if not is_valid_status_transition(order.status, request.status):
        raise ValueError(
            f"无效的状态转换: {order.status.value} -> {request.status.value}"
        )
    
    from_status = order.status
    order.status = request.status
    
    if request.status == MaintenanceStatus.COMPLETED:
        order.completed_at = datetime.utcnow()
        order.completion_note = request.completion_note
        
        for order_part in order.parts:
            if order_part.part_code and order_part.is_reserved:
                inventory = db.query(Inventory).filter(
                    Inventory.part_code == order_part.part_code
                ).first()
                if inventory:
                    inventory.reserved_quantity = max(0, inventory.reserved_quantity - order_part.quantity)
                    inventory.total_quantity = max(0, inventory.total_quantity - order_part.quantity)
    
    if request.status == MaintenanceStatus.CANCELLED:
        for order_part in order.parts:
            if order_part.part_code and order_part.is_reserved:
                inventory = db.query(Inventory).filter(
                    Inventory.part_code == order_part.part_code
                ).first()
                if inventory:
                    inventory.reserved_quantity = max(0, inventory.reserved_quantity - order_part.quantity)
                order_part.is_reserved = 0
    
    add_history(
        db, order.id, order.device_id,
        action="STATUS_CHANGE",
        from_status=from_status,
        to_status=request.status,
        note=request.note
    )
    
    db.commit()
    db.refresh(order)
    return order


def delay_order(db: Session, order_id: int, request: DelayOrderRequest) -> MaintenanceOrder:
    order = get_order(db, order_id)
    if not order:
        raise ValueError(f"工单 ID {order_id} 不存在")
    
    if order.status not in [MaintenanceStatus.PENDING, MaintenanceStatus.IN_PROGRESS]:
        raise ValueError(
            f"只有待处理或进行中的工单才能延期，当前状态: {order.status.value}"
        )
    
    if request.new_due_date < (order.original_due_date or date.today()):
        raise ValueError("延期日期不能早于原始截止日期")
    
    from_status = order.status
    order.status = MaintenanceStatus.DELAYED
    order.due_date = request.new_due_date
    order.delay_count += 1
    
    add_history(
        db, order.id, order.device_id,
        action="DELAY",
        from_status=from_status,
        to_status=MaintenanceStatus.DELAYED,
        note=request.reason or f"延期至 {request.new_due_date}"
    )
    
    db.commit()
    db.refresh(order)
    return order


def get_order_history(db: Session, order_id: int) -> List[MaintenanceHistory]:
    return db.query(MaintenanceHistory).filter(
        MaintenanceHistory.order_id == order_id
    ).order_by(MaintenanceHistory.created_at).all()


def create_inventory(db: Session, data: InventoryCreate) -> Inventory:
    existing = db.query(Inventory).filter(
        Inventory.part_code == data.part_code
    ).first()
    if existing:
        raise ValueError(f"配件编码 {data.part_code} 已存在")
    
    inventory = Inventory(**data.model_dump())
    db.add(inventory)
    db.commit()
    db.refresh(inventory)
    return inventory


def get_all_inventory(db: Session) -> List[Inventory]:
    return db.query(Inventory).all()


def get_maintenance_report(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    device_id: Optional[int] = None,
    status: Optional[MaintenanceStatus] = None
) -> dict:
    query = db.query(MaintenanceOrder)
    
    if start_date:
        query = query.filter(MaintenanceOrder.created_at >= start_date)
    if end_date:
        query = query.filter(MaintenanceOrder.created_at <= end_date)
    if device_id:
        query = query.filter(MaintenanceOrder.device_id == device_id)
    if status:
        query = query.filter(MaintenanceOrder.status == status)
    
    orders = query.all()
    
    total = len(orders)
    pending = sum(1 for o in orders if o.status == MaintenanceStatus.PENDING)
    in_progress = sum(1 for o in orders if o.status == MaintenanceStatus.IN_PROGRESS)
    completed = sum(1 for o in orders if o.status == MaintenanceStatus.COMPLETED)
    delayed = sum(1 for o in orders if o.status == MaintenanceStatus.DELAYED)
    cancelled = sum(1 for o in orders if o.status == MaintenanceStatus.CANCELLED)
    
    completed_orders = [o for o in orders if o.status == MaintenanceStatus.COMPLETED and o.completed_at]
    if completed_orders:
        total_days = sum(
            (o.completed_at.date() - o.scheduled_date).days 
            for o in completed_orders if o.scheduled_date
        )
        avg_days = total_days / len(completed_orders)
    else:
        avg_days = None
    
    devices_needing = []
    active_rules = db.query(MaintenanceRule).filter(MaintenanceRule.is_active == 1).all()
    today = date.today()
    
    for rule in active_rules:
        device = rule.device
        if not device:
            continue
        
        if rule.rule_type == RuleType.HOURS:
            last_value = get_last_maintenance_value(db, device.id, rule.rule_type)
            effective_threshold = last_value + rule.threshold_value
            if device.total_hours >= effective_threshold:
                devices_needing.append({
                    "device_id": device.id,
                    "device_name": device.name,
                    "rule_name": rule.name,
                    "rule_type": rule.rule_type.value,
                    "current_value": device.total_hours,
                    "threshold": effective_threshold
                })
        elif rule.rule_type == RuleType.COUNT:
            last_value = get_last_maintenance_value(db, device.id, rule.rule_type)
            effective_threshold = last_value + rule.threshold_value
            if device.total_count >= effective_threshold:
                devices_needing.append({
                    "device_id": device.id,
                    "device_name": device.name,
                    "rule_name": rule.name,
                    "rule_type": rule.rule_type.value,
                    "current_value": device.total_count,
                    "threshold": effective_threshold
                })
        elif rule.rule_type == RuleType.DATE:
            last_completed = get_last_completed_date(db, device.id, rule.rule_type)
            interval_days = int(rule.threshold_value)
            if last_completed:
                next_due_date = last_completed + timedelta(days=interval_days)
            else:
                next_due_date = rule.created_at.date() + timedelta(days=interval_days)
            if today >= next_due_date:
                devices_needing.append({
                    "device_id": device.id,
                    "device_name": device.name,
                    "rule_name": rule.name,
                    "rule_type": rule.rule_type.value,
                    "current_date": today.isoformat(),
                    "threshold_date": next_due_date.isoformat(),
                    "interval_days": interval_days
                })
    
    return {
        "total_orders": total,
        "pending_count": pending,
        "in_progress_count": in_progress,
        "completed_count": completed,
        "delayed_count": delayed,
        "cancelled_count": cancelled,
        "avg_completion_days": avg_days,
        "devices_needing_maintenance": devices_needing
    }
