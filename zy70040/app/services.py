from datetime import datetime, timedelta
import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
import json

from app.models import (
    DepositOrder, DepositStatus, ScanRecord, DamageRecord,
    RefundOrder, RefundStatus, OperationHistory, ReconciliationBatch,
    PackageType
)


def generate_order_no(prefix: str) -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_suffix = uuid.uuid4().hex[:6].upper()
    return f"{prefix}{timestamp}{random_suffix}"


def _serialize_snapshot(data: Any) -> Optional[str]:
    try:
        return json.dumps(data, ensure_ascii=False, default=str) if data else None
    except Exception:
        return None


def _record_operation(
    db: Session,
    operation_type: str,
    operation_desc: str,
    entity_type: Optional[str],
    entity_id: Optional[int],
    entity_no: Optional[str],
    operator_id: str,
    operator_name: str,
    before_snapshot: Any = None,
    after_snapshot: Any = None,
    is_reverse: bool = False,
    reverse_related_id: Optional[int] = None,
    remark: Optional[str] = None,
) -> OperationHistory:
    history = OperationHistory(
        operation_type=operation_type,
        operation_desc=operation_desc,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_no=entity_no,
        before_snapshot=_serialize_snapshot(before_snapshot),
        after_snapshot=_serialize_snapshot(after_snapshot),
        operator_id=operator_id,
        operator_name=operator_name,
        is_reverse=is_reverse,
        reverse_related_id=reverse_related_id,
        remark=remark,
    )
    db.add(history)
    db.flush()
    return history


def _order_to_dict(order: DepositOrder) -> Dict:
    return {
        "id": order.id,
        "order_no": order.order_no,
        "status": order.status,
        "total_deposit": order.total_deposit,
        "total_deduction": order.total_deduction,
        "refunded_amount": order.refunded_amount,
        "refundable_amount": order.refundable_amount,
    }


def create_deposit_order(db: Session, data: Dict) -> DepositOrder:
    order_no = generate_order_no("DO")

    total_deposit = (
        data["cycle_box_deposit"] +
        data["thermal_bag_deposit"] +
        data["pallet_deposit"]
    )

    order = DepositOrder(
        order_no=order_no,
        customer_id=data["customer_id"],
        customer_name=data["customer_name"],
        cycle_box_count=data["cycle_box_count"],
        thermal_bag_count=data["thermal_bag_count"],
        pallet_count=data["pallet_count"],
        cycle_box_deposit=data["cycle_box_deposit"],
        thermal_bag_deposit=data["thermal_bag_deposit"],
        pallet_deposit=data["pallet_deposit"],
        total_deposit=total_deposit,
        refundable_amount=total_deposit,
        remark=data.get("remark"),
        status=DepositStatus.PAID,
    )
    db.add(order)
    db.flush()

    _record_operation(
        db=db,
        operation_type="create_deposit",
        operation_desc=f"创建押金单 {order_no}",
        entity_type="deposit_order",
        entity_id=order.id,
        entity_no=order_no,
        operator_id=data["operator_id"],
        operator_name=data["operator_name"],
        after_snapshot=_order_to_dict(order),
    )

    db.commit()
    db.refresh(order)
    return order


def get_deposit_order(db: Session, order_no: str) -> Optional[DepositOrder]:
    return db.query(DepositOrder).filter(
        DepositOrder.order_no == order_no,
        DepositOrder.is_deleted == False
    ).first()


def get_deposit_order_by_id(db: Session, order_id: int) -> Optional[DepositOrder]:
    return db.query(DepositOrder).filter(
        DepositOrder.id == order_id,
        DepositOrder.is_deleted == False
    ).first()


def list_deposit_orders(
    db: Session,
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[DepositOrder]:
    query = db.query(DepositOrder).filter(DepositOrder.is_deleted == False)

    if customer_id:
        query = query.filter(DepositOrder.customer_id == customer_id)
    if status:
        query = query.filter(DepositOrder.status == status)
    if start_date:
        query = query.filter(DepositOrder.created_at >= start_date)
    if end_date:
        query = query.filter(DepositOrder.created_at < end_date)

    return query.order_by(DepositOrder.created_at.desc()).offset(skip).limit(limit).all()


def _update_deposit_status(db: Session, order: DepositOrder) -> None:
    cycle_box_total = order.cycle_box_returned + order.cycle_box_damaged
    thermal_bag_total = order.thermal_bag_returned + order.thermal_bag_damaged
    pallet_total = order.pallet_returned + order.pallet_damaged

    cycle_box_done = cycle_box_total >= order.cycle_box_count
    thermal_bag_done = thermal_bag_total >= order.thermal_bag_count
    pallet_done = pallet_total >= order.pallet_count

    if cycle_box_done and thermal_bag_done and pallet_done:
        order.status = DepositStatus.FULL_RETURNED
    elif (
        order.cycle_box_returned > 0 or
        order.thermal_bag_returned > 0 or
        order.pallet_returned > 0 or
        order.cycle_box_damaged > 0 or
        order.thermal_bag_damaged > 0 or
        order.pallet_damaged > 0
    ):
        order.status = DepositStatus.PARTIAL_RETURNED


def _calculate_refundable_amount(db: Session, order: DepositOrder) -> None:
    order.refundable_amount = max(0.0, order.total_deposit - order.total_deduction - order.refunded_amount)


def _get_unit_deposit(order: DepositOrder, package_type: str) -> float:
    if package_type == PackageType.CYCLE_BOX and order.cycle_box_count > 0:
        return order.cycle_box_deposit / order.cycle_box_count
    elif package_type == PackageType.THERMAL_BAG and order.thermal_bag_count > 0:
        return order.thermal_bag_deposit / order.thermal_bag_count
    elif package_type == PackageType.PALLET and order.pallet_count > 0:
        return order.pallet_deposit / order.pallet_count
    return 0.0


def _get_remaining_count(order: DepositOrder, package_type: str) -> int:
    if package_type == PackageType.CYCLE_BOX:
        return max(0, order.cycle_box_count - order.cycle_box_returned - order.cycle_box_damaged)
    elif package_type == PackageType.THERMAL_BAG:
        return max(0, order.thermal_bag_count - order.thermal_bag_returned - order.thermal_bag_damaged)
    elif package_type == PackageType.PALLET:
        return max(0, order.pallet_count - order.pallet_returned - order.pallet_damaged)
    return 0


def scan_package(db: Session, data: Dict) -> ScanRecord:
    order = get_deposit_order(db, data["deposit_order_no"])
    if not order:
        raise ValueError(f"押金单不存在: {data['deposit_order_no']}")

    package_type = data["package_type"]
    if package_type not in PackageType.ALL_TYPES:
        raise ValueError(f"无效的包材类型: {package_type}")

    quantity = data.get("quantity", 1)
    remaining = _get_remaining_count(order, package_type)
    if remaining < quantity:
        raise ValueError(
            f"{package_type} 剩余未归还数量不足: 需要 {quantity}, 剩余 {remaining}"
        )

    existing = db.query(ScanRecord).filter(
        ScanRecord.deposit_order_id == order.id,
        ScanRecord.package_type == package_type,
        ScanRecord.package_code == data["package_code"],
        ScanRecord.is_reversed == False
    ).first()

    if existing:
        return existing

    scan_no = generate_order_no("SC")
    scan_time = data.get("scan_time") or datetime.utcnow()

    before_snapshot = _order_to_dict(order)

    record = ScanRecord(
        scan_no=scan_no,
        deposit_order_id=order.id,
        package_type=package_type,
        package_code=data["package_code"],
        quantity=quantity,
        operator_id=data["operator_id"],
        operator_name=data["operator_name"],
        scan_time=scan_time,
        remark=data.get("remark"),
    )
    db.add(record)
    db.flush()

    if package_type == PackageType.CYCLE_BOX:
        order.cycle_box_returned += quantity
    elif package_type == PackageType.THERMAL_BAG:
        order.thermal_bag_returned += quantity
    elif package_type == PackageType.PALLET:
        order.pallet_returned += quantity

    _update_deposit_status(db, order)

    after_snapshot = _order_to_dict(order)

    _record_operation(
        db=db,
        operation_type="scan_package",
        operation_desc=f"扫码归还 {package_type} {data['package_code']}",
        entity_type="scan_record",
        entity_id=record.id,
        entity_no=scan_no,
        operator_id=data["operator_id"],
        operator_name=data["operator_name"],
        before_snapshot=before_snapshot,
        after_snapshot=after_snapshot,
    )

    db.commit()
    db.refresh(record)
    return record


def get_scan_records(
    db: Session,
    deposit_order_id: Optional[int] = None,
    is_reversed: Optional[bool] = None,
) -> List[ScanRecord]:
    query = db.query(ScanRecord)
    if deposit_order_id is not None:
        query = query.filter(ScanRecord.deposit_order_id == deposit_order_id)
    if is_reversed is not None:
        query = query.filter(ScanRecord.is_reversed == is_reversed)
    return query.order_by(ScanRecord.scan_time.desc()).all()


def reverse_scan_record(
    db: Session,
    scan_id: int,
    reason: str,
    operator_id: str,
    operator_name: str,
) -> ScanRecord:
    record = db.query(ScanRecord).filter(ScanRecord.id == scan_id).first()
    if not record:
        raise ValueError(f"扫码记录不存在: {scan_id}")
    if record.is_reversed:
        raise ValueError(f"扫码记录已被撤回: {record.scan_no}")

    order = get_deposit_order_by_id(db, record.deposit_order_id)
    if not order:
        raise ValueError(f"关联押金单不存在")

    before_snapshot = _order_to_dict(order)

    if record.package_type == PackageType.CYCLE_BOX:
        order.cycle_box_returned = max(0, order.cycle_box_returned - record.quantity)
    elif record.package_type == PackageType.THERMAL_BAG:
        order.thermal_bag_returned = max(0, order.thermal_bag_returned - record.quantity)
    elif record.package_type == PackageType.PALLET:
        order.pallet_returned = max(0, order.pallet_returned - record.quantity)

    record.is_reversed = True
    record.reversed_at = datetime.utcnow()
    record.reversed_by = operator_id
    record.reverse_reason = reason

    _update_deposit_status(db, order)

    after_snapshot = _order_to_dict(order)

    history = _record_operation(
        db=db,
        operation_type="reverse_scan",
        operation_desc=f"撤回扫码记录 {record.scan_no}",
        entity_type="scan_record",
        entity_id=record.id,
        entity_no=record.scan_no,
        operator_id=operator_id,
        operator_name=operator_name,
        before_snapshot=before_snapshot,
        after_snapshot=after_snapshot,
        is_reverse=True,
        remark=reason,
    )

    db.commit()
    db.refresh(record)
    return record


def record_damage(db: Session, data: Dict) -> DamageRecord:
    order = get_deposit_order(db, data["deposit_order_no"])
    if not order:
        raise ValueError(f"押金单不存在: {data['deposit_order_no']}")

    package_type = data["package_type"]
    if package_type not in PackageType.ALL_TYPES:
        raise ValueError(f"无效的包材类型: {package_type}")

    quantity = data.get("quantity", 1)
    remaining = _get_remaining_count(order, package_type)
    if remaining < quantity:
        raise ValueError(
            f"{package_type} 剩余未处理数量不足: 需要 {quantity}, 剩余 {remaining}"
        )

    existing = db.query(DamageRecord).filter(
        DamageRecord.deposit_order_id == order.id,
        DamageRecord.package_type == package_type,
        DamageRecord.package_code == data["package_code"],
        DamageRecord.is_reversed == False
    ).first()

    if existing:
        return existing

    damage_no = generate_order_no("DM")
    deduction_amount = data["deduction_amount"]

    before_snapshot = _order_to_dict(order)

    record = DamageRecord(
        damage_no=damage_no,
        deposit_order_id=order.id,
        package_type=package_type,
        package_code=data["package_code"],
        quantity=quantity,
        deduction_amount=deduction_amount,
        damage_level=data.get("damage_level"),
        damage_description=data.get("damage_description"),
        operator_id=data["operator_id"],
        operator_name=data["operator_name"],
        remark=data.get("remark"),
    )
    db.add(record)
    db.flush()

    if package_type == PackageType.CYCLE_BOX:
        order.cycle_box_damaged += quantity
        order.cycle_box_deduction += deduction_amount
    elif package_type == PackageType.THERMAL_BAG:
        order.thermal_bag_damaged += quantity
        order.thermal_bag_deduction += deduction_amount
    elif package_type == PackageType.PALLET:
        order.pallet_damaged += quantity
        order.pallet_deduction += deduction_amount

    order.total_deduction = (
        order.cycle_box_deduction +
        order.thermal_bag_deduction +
        order.pallet_deduction
    )
    _calculate_refundable_amount(db, order)
    _update_deposit_status(db, order)

    after_snapshot = _order_to_dict(order)

    _record_operation(
        db=db,
        operation_type="record_damage",
        operation_desc=f"记录损坏扣减 {package_type} {data['package_code']}",
        entity_type="damage_record",
        entity_id=record.id,
        entity_no=damage_no,
        operator_id=data["operator_id"],
        operator_name=data["operator_name"],
        before_snapshot=before_snapshot,
        after_snapshot=after_snapshot,
    )

    db.commit()
    db.refresh(record)
    return record


def get_damage_records(
    db: Session,
    deposit_order_id: Optional[int] = None,
    is_reversed: Optional[bool] = None,
) -> List[DamageRecord]:
    query = db.query(DamageRecord)
    if deposit_order_id is not None:
        query = query.filter(DamageRecord.deposit_order_id == deposit_order_id)
    if is_reversed is not None:
        query = query.filter(DamageRecord.is_reversed == is_reversed)
    return query.order_by(DamageRecord.created_at.desc()).all()


def reverse_damage_record(
    db: Session,
    damage_id: int,
    reason: str,
    operator_id: str,
    operator_name: str,
) -> DamageRecord:
    record = db.query(DamageRecord).filter(DamageRecord.id == damage_id).first()
    if not record:
        raise ValueError(f"损坏记录不存在: {damage_id}")
    if record.is_reversed:
        raise ValueError(f"损坏记录已被撤回: {record.damage_no}")

    order = get_deposit_order_by_id(db, record.deposit_order_id)
    if not order:
        raise ValueError(f"关联押金单不存在")

    before_snapshot = _order_to_dict(order)

    if record.package_type == PackageType.CYCLE_BOX:
        order.cycle_box_damaged = max(0, order.cycle_box_damaged - record.quantity)
        order.cycle_box_deduction = max(0.0, order.cycle_box_deduction - record.deduction_amount)
    elif record.package_type == PackageType.THERMAL_BAG:
        order.thermal_bag_damaged = max(0, order.thermal_bag_damaged - record.quantity)
        order.thermal_bag_deduction = max(0.0, order.thermal_bag_deduction - record.deduction_amount)
    elif record.package_type == PackageType.PALLET:
        order.pallet_damaged = max(0, order.pallet_damaged - record.quantity)
        order.pallet_deduction = max(0.0, order.pallet_deduction - record.deduction_amount)

    order.total_deduction = (
        order.cycle_box_deduction +
        order.thermal_bag_deduction +
        order.pallet_deduction
    )
    _calculate_refundable_amount(db, order)
    _update_deposit_status(db, order)

    record.is_reversed = True
    record.reversed_at = datetime.utcnow()
    record.reversed_by = operator_id
    record.reverse_reason = reason

    after_snapshot = _order_to_dict(order)

    _record_operation(
        db=db,
        operation_type="reverse_damage",
        operation_desc=f"撤回损坏记录 {record.damage_no}",
        entity_type="damage_record",
        entity_id=record.id,
        entity_no=record.damage_no,
        operator_id=operator_id,
        operator_name=operator_name,
        before_snapshot=before_snapshot,
        after_snapshot=after_snapshot,
        is_reverse=True,
        remark=reason,
    )

    db.commit()
    db.refresh(record)
    return record


def _calculate_refund_amounts(db: Session, order: DepositOrder) -> Dict:
    cycle_box_unit = _get_unit_deposit(order, PackageType.CYCLE_BOX)
    thermal_bag_unit = _get_unit_deposit(order, PackageType.THERMAL_BAG)
    pallet_unit = _get_unit_deposit(order, PackageType.PALLET)

    cycle_box_refund = order.cycle_box_returned * cycle_box_unit
    thermal_bag_refund = order.thermal_bag_returned * thermal_bag_unit
    pallet_refund = order.pallet_returned * pallet_unit

    total_refund = cycle_box_refund + thermal_bag_refund + pallet_refund
    remaining_refund = max(0.0, order.total_deposit - order.total_deduction - order.refunded_amount)

    if total_refund > remaining_refund:
        ratio = remaining_refund / total_refund if total_refund > 0 else 0
        cycle_box_refund = cycle_box_refund * ratio
        thermal_bag_refund = thermal_bag_refund * ratio
        pallet_refund = pallet_refund * ratio
        total_refund = remaining_refund

    return {
        "cycle_box_refund": round(cycle_box_refund, 2),
        "thermal_bag_refund": round(thermal_bag_refund, 2),
        "pallet_refund": round(pallet_refund, 2),
        "total_refund": round(total_refund, 2),
    }


def create_refund_from_order(
    db: Session,
    order_no: str,
    operator_id: str,
    operator_name: str,
    refund_method: Optional[str] = None,
) -> RefundOrder:
    order = get_deposit_order(db, order_no)
    if not order:
        raise ValueError(f"押金单不存在: {order_no}")

    if order.status not in [DepositStatus.FULL_RETURNED, DepositStatus.PARTIAL_RETURNED]:
        raise ValueError(f"押金单状态不允许退款: {order.status}")

    existing_pending = db.query(RefundOrder).filter(
        RefundOrder.deposit_order_id == order.id,
        RefundOrder.status.in_([RefundStatus.PENDING, RefundStatus.PROCESSING])
    ).first()

    if existing_pending:
        return existing_pending

    refundable = order.refundable_amount
    if refundable <= 0:
        raise ValueError(f"无可退押金: {refundable}")

    amounts = _calculate_refund_amounts(db, order)

    refund_no = generate_order_no("RF")
    refund = RefundOrder(
        refund_no=refund_no,
        deposit_order_id=order.id,
        refund_amount=amounts["total_refund"],
        cycle_box_refund=amounts["cycle_box_refund"],
        thermal_bag_refund=amounts["thermal_bag_refund"],
        pallet_refund=amounts["pallet_refund"],
        refund_method=refund_method,
        status=RefundStatus.PENDING,
        operator_id=operator_id,
        operator_name=operator_name,
    )
    db.add(refund)
    db.flush()

    _record_operation(
        db=db,
        operation_type="create_refund",
        operation_desc=f"创建退款订单 {refund_no}",
        entity_type="refund_order",
        entity_id=refund.id,
        entity_no=refund_no,
        operator_id=operator_id,
        operator_name=operator_name,
        after_snapshot={
            "refund_no": refund_no,
            "amount": amounts["total_refund"],
            "status": RefundStatus.PENDING,
        },
    )

    db.commit()
    db.refresh(refund)
    return refund


def list_pending_refunds(db: Session) -> List[RefundOrder]:
    return db.query(RefundOrder).filter(
        RefundOrder.status == RefundStatus.PENDING
    ).order_by(RefundOrder.created_at.asc()).all()


def process_refund(
    db: Session,
    refund_id: int,
    transaction_id: Optional[str] = None,
) -> RefundOrder:
    refund = db.query(RefundOrder).filter(RefundOrder.id == refund_id).first()
    if not refund:
        raise ValueError(f"退款订单不存在: {refund_id}")
    if refund.status != RefundStatus.PENDING:
        raise ValueError(f"退款订单状态不允许处理: {refund.status}")

    order = get_deposit_order_by_id(db, refund.deposit_order_id)
    if not order:
        raise ValueError(f"关联押金单不存在")

    refund.status = RefundStatus.PROCESSING
    refund.processed_at = datetime.utcnow()
    refund.transaction_id = transaction_id
    db.flush()

    refund.status = RefundStatus.SUCCESS
    refund.completed_at = datetime.utcnow()

    order.refunded_amount += refund.refund_amount
    _calculate_refundable_amount(db, order)

    if order.refundable_amount <= 0:
        order.status = DepositStatus.CLOSED

    after_snapshot = {
        "refund_no": refund.refund_no,
        "amount": refund.refund_amount,
        "status": RefundStatus.SUCCESS,
        "transaction_id": transaction_id,
    }

    _record_operation(
        db=db,
        operation_type="process_refund",
        operation_desc=f"处理退款完成 {refund.refund_no}",
        entity_type="refund_order",
        entity_id=refund.id,
        entity_no=refund.refund_no,
        operator_id="system",
        operator_name="系统自动处理",
        after_snapshot=after_snapshot,
    )

    db.commit()
    db.refresh(refund)
    return refund


def list_refund_orders(
    db: Session,
    deposit_order_id: Optional[int] = None,
    status: Optional[str] = None,
) -> List[RefundOrder]:
    query = db.query(RefundOrder)
    if deposit_order_id is not None:
        query = query.filter(RefundOrder.deposit_order_id == deposit_order_id)
    if status:
        query = query.filter(RefundOrder.status == status)
    return query.order_by(RefundOrder.created_at.desc()).all()


def get_operation_history(
    db: Session,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    entity_no: Optional[str] = None,
    operation_type: Optional[str] = None,
    limit: int = 100,
) -> List[OperationHistory]:
    query = db.query(OperationHistory)
    if entity_type:
        query = query.filter(OperationHistory.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(OperationHistory.entity_id == entity_id)
    if entity_no:
        query = query.filter(OperationHistory.entity_no == entity_no)
    if operation_type:
        query = query.filter(OperationHistory.operation_type == operation_type)
    return query.order_by(OperationHistory.operation_time.desc()).limit(limit).all()


def create_reconciliation_batch(
    db: Session,
    start_date: datetime,
    end_date: datetime,
    operator_id: str,
    operator_name: str,
) -> ReconciliationBatch:
    batch_no = generate_order_no("RC")

    orders = db.query(DepositOrder).filter(
        DepositOrder.is_deleted == False,
        DepositOrder.created_at >= start_date,
        DepositOrder.created_at < end_date,
    ).all()

    total_orders = len(orders)
    total_deposit = sum(o.total_deposit for o in orders)
    total_refund = sum(o.refunded_amount for o in orders)
    total_deduction = sum(o.total_deduction for o in orders)
    remaining_deposit = sum(o.refundable_amount for o in orders)

    order_ids = [o.id for o in orders]

    scans = db.query(ScanRecord).filter(
        ScanRecord.deposit_order_id.in_(order_ids),
        ScanRecord.is_reversed == False,
    ).all()

    scan_matched = len(scans)
    scan_unmatched = 0

    refunds = db.query(RefundOrder).filter(
        RefundOrder.deposit_order_id.in_(order_ids),
        RefundOrder.status == RefundStatus.SUCCESS,
    ).all()

    refund_matched = len(refunds)
    refund_unmatched = 0

    batch = ReconciliationBatch(
        batch_no=batch_no,
        start_date=start_date,
        end_date=end_date,
        total_orders=total_orders,
        total_deposit=total_deposit,
        total_refund=total_refund,
        total_deduction=total_deduction,
        remaining_deposit=remaining_deposit,
        scan_matched=scan_matched,
        scan_unmatched=scan_unmatched,
        refund_matched=refund_matched,
        refund_unmatched=refund_unmatched,
        operator_id=operator_id,
        operator_name=operator_name,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    _record_operation(
        db=db,
        operation_type="create_reconciliation",
        operation_desc=f"创建对账批次 {batch_no}",
        entity_type="reconciliation_batch",
        entity_id=batch.id,
        entity_no=batch_no,
        operator_id=operator_id,
        operator_name=operator_name,
        after_snapshot={
            "batch_no": batch_no,
            "total_orders": total_orders,
            "total_deposit": total_deposit,
            "total_refund": total_refund,
            "total_deduction": total_deduction,
        },
    )

    db.refresh(batch)
    return batch


def get_reconciliation_batches(
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> List[ReconciliationBatch]:
    return db.query(ReconciliationBatch).order_by(
        ReconciliationBatch.created_at.desc()
    ).offset(skip).limit(limit).all()
