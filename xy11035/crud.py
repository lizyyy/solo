from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
from typing import List, Optional
import models
import schemas
from exceptions import (
    OrderNotFoundError,
    OrderAlreadyExistsError,
    InvalidQueuePositionError,
    DeliveryTimeConflictError,
    CapacityConsistencyError,
    StatusTransitionError
)


def get_urgent_order(db: Session, order_id: int):
    order = db.query(models.PrintUrgentOrder).filter(models.PrintUrgentOrder.id == order_id).first()
    if not order:
        raise OrderNotFoundError(str(order_id))
    return order


def get_urgent_order_by_no(db: Session, order_no: str):
    return db.query(models.PrintUrgentOrder).filter(models.PrintUrgentOrder.order_no == order_no).first()


def get_urgent_orders(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None):
    query = db.query(models.PrintUrgentOrder)
    if status:
        query = query.filter(models.PrintUrgentOrder.status == status)
    return query.order_by(desc(models.PrintUrgentOrder.created_at)).offset(skip).limit(limit).all()


def get_current_queue_length(db: Session) -> int:
    return db.query(models.PrintUrgentOrder).filter(
        models.PrintUrgentOrder.status.in_([models.UrgentStatus.NORMAL, models.UrgentStatus.SUPPLEMENTED])
    ).count()


def simulate_delivery_impact(db: Session, target_position: int, page_count: int):
    pending_orders = db.query(models.PrintUrgentOrder).filter(
        models.PrintUrgentOrder.status.in_([models.UrgentStatus.NORMAL, models.UrgentStatus.SUPPLEMENTED])
    ).order_by(models.PrintUrgentOrder.queue_position_after).all()

    affected_orders = []
    for idx, order in enumerate(pending_orders):
        if idx >= target_position - 1:
            estimated_delay = (page_count * 0.5) / 60
            new_delivery = order.original_promised_time + timedelta(hours=estimated_delay)
            affected_orders.append({
                "order_no": order.order_no,
                "customer_name": order.customer_name,
                "original_delivery": order.original_promised_time.isoformat(),
                "estimated_new_delivery": new_delivery.isoformat(),
                "delay_minutes": round(estimated_delay * 60, 2)
            })

    return affected_orders


def create_capacity_log(db: Session, log_data: schemas.CapacityLogBase, urgent_order_id: Optional[int] = None):
    existing_log = db.query(models.CapacityLog).filter(models.CapacityLog.log_no == log_data.log_no).first()
    if existing_log:
        raise CapacityConsistencyError(
            log_no=log_data.log_no,
            existing_log={
                "id": existing_log.id,
                "log_type": existing_log.log_type,
                "created_at": existing_log.created_at.isoformat(),
                "operator": existing_log.operator
            },
            attempted_override=log_data.dict()
        )

    db_log = models.CapacityLog(
        **log_data.dict(),
        urgent_order_id=urgent_order_id
    )
    db.add(db_log)
    db.flush()
    return db_log


def create_urgent_order(db: Session, order: schemas.PrintUrgentOrderCreate):
    existing_order = get_urgent_order_by_no(db, order.order_no)
    if existing_order:
        raise OrderAlreadyExistsError(order.order_no)

    queue_length = get_current_queue_length(db)
    max_position = queue_length + 1
    if order.target_queue_position < 1 or order.target_queue_position > max_position:
        raise InvalidQueuePositionError(order.target_queue_position, max_position)

    affected_orders = simulate_delivery_impact(db, order.target_queue_position, order.page_count)

    new_promised_time = order.original_promised_time - timedelta(hours=2)

    db_order = models.PrintUrgentOrder(
        order_no=order.order_no,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        document_name=order.document_name,
        page_count=order.page_count,
        color_mode=order.color_mode,
        paper_size=order.paper_size,
        double_sided=order.double_sided,
        binding_type=order.binding_type,
        original_promised_time=order.original_promised_time,
        new_promised_time=new_promised_time,
        urgent_reason=order.urgent_reason,
        queue_position_before=max_position,
        queue_position_after=order.target_queue_position,
        status=models.UrgentStatus.NORMAL,
        operator=order.operator
    )
    db.add(db_order)
    db.flush()

    if affected_orders:
        log_data = schemas.CapacityLogBase(
            log_no=f"CAP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            log_type="URGENT_INSERT_IMPACT",
            capacity_impact=len(affected_orders) * 0.1,
            impact_description=f"急单插队影响 {len(affected_orders)} 个订单的交付时间",
            operator=order.operator
        )
        create_capacity_log(db, log_data, urgent_order_id=db_order.id)

    if affected_orders:
        raise DeliveryTimeConflictError(
            affected_orders=affected_orders,
            conflict_details={
                "urgent_order_no": order.order_no,
                "target_position": order.target_queue_position,
                "urgent_page_count": order.page_count,
                "confirmation_required": True
            }
        )

    return db_order


def update_urgent_order_status(db: Session, order_id: int, update_data: schemas.PrintUrgentOrderUpdate):
    db_order = get_urgent_order(db, order_id)

    allowed_transitions = {
        models.UrgentStatus.NORMAL: [models.UrgentStatus.REJECTED, models.UrgentStatus.SUPPLEMENTED, models.UrgentStatus.COMPLETED],
        models.UrgentStatus.SUPPLEMENTED: [models.UrgentStatus.COMPLETED, models.UrgentStatus.REJECTED],
        models.UrgentStatus.REJECTED: [],
        models.UrgentStatus.COMPLETED: []
    }

    if update_data.status and update_data.status not in allowed_transitions.get(db_order.status, []):
        raise StatusTransitionError(db_order.status, update_data.status)

    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(db_order, key, value)

    db_order.updated_at = datetime.utcnow()
    db.flush()

    log_data = schemas.CapacityLogBase(
        log_no=f"CAP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        log_type=f"STATUS_CHANGE_{update_data.status.upper()}",
        capacity_impact=0,
        impact_description=f"订单状态从 {db_order.status} 变更为 {update_data.status}",
        operator=update_data.operator
    )
    create_capacity_log(db, log_data, urgent_order_id=db_order.id)

    return db_order


def force_insert_urgent_order(db: Session, order: schemas.PrintUrgentOrderCreate):
    existing_order = get_urgent_order_by_no(db, order.order_no)
    if existing_order:
        raise OrderAlreadyExistsError(order.order_no)

    queue_length = get_current_queue_length(db)
    max_position = queue_length + 1

    new_promised_time = order.original_promised_time - timedelta(hours=2)

    db_order = models.PrintUrgentOrder(
        order_no=order.order_no,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        document_name=order.document_name,
        page_count=order.page_count,
        color_mode=order.color_mode,
        paper_size=order.paper_size,
        double_sided=order.double_sided,
        binding_type=order.binding_type,
        original_promised_time=order.original_promised_time,
        new_promised_time=new_promised_time,
        urgent_reason=order.urgent_reason,
        queue_position_before=max_position,
        queue_position_after=order.target_queue_position,
        status=models.UrgentStatus.NORMAL,
        operator=order.operator
    )
    db.add(db_order)
    db.flush()

    affected_orders = simulate_delivery_impact(db, order.target_queue_position, order.page_count)
    for affected in affected_orders:
        log_data = schemas.CapacityLogBase(
            log_no=f"CAP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{affected['order_no']}",
            log_type="DELIVERY_DELAY_CONFIRMED",
            affected_order_no=affected["order_no"],
            capacity_impact=0.1,
            impact_description=f"确认延迟: {affected['order_no']} 延迟 {affected['delay_minutes']} 分钟",
            operator=order.operator
        )
        create_capacity_log(db, log_data, urgent_order_id=db_order.id)

    db.commit()
    db.refresh(db_order)
    return db_order


def get_capacity_logs(db: Session, urgent_order_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.CapacityLog)
    if urgent_order_id:
        query = query.filter(models.CapacityLog.urgent_order_id == urgent_order_id)
    return query.order_by(desc(models.CapacityLog.created_at)).offset(skip).limit(limit).all()


def export_orders_to_dict(db: Session, status: Optional[str] = None):
    orders = get_urgent_orders(db, status=status)
    result = []
    for order in orders:
        order_dict = {
            "id": order.id,
            "order_no": order.order_no,
            "customer_name": order.customer_name,
            "customer_phone": order.customer_phone,
            "document_name": order.document_name,
            "page_count": order.page_count,
            "color_mode": order.color_mode,
            "paper_size": order.paper_size,
            "double_sided": order.double_sided,
            "binding_type": order.binding_type,
            "original_promised_time": order.original_promised_time.isoformat() if order.original_promised_time else None,
            "new_promised_time": order.new_promised_time.isoformat() if order.new_promised_time else None,
            "urgent_reason": order.urgent_reason,
            "queue_position_before": order.queue_position_before,
            "queue_position_after": order.queue_position_after,
            "status": order.status,
            "reject_reason": order.reject_reason,
            "supplement_notes": order.supplement_notes,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "operator": order.operator
        }
        result.append(order_dict)
    return result
