import json
from datetime import datetime
from typing import List, Tuple
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .models import ReconciliationStatus, DiscrepancyType, ActionType


def reconcile_transactions(
    db: Session,
    batch_id: int
) -> Tuple[int, int]:
    batch = crud.get_batch(db, batch_id)
    if not batch:
        return 0, 0
    
    crud.update_batch_status(db, batch_id, ReconciliationStatus.PROCESSING)
    
    channel_transactions = db.query(models.ChannelTransaction).filter(
        models.ChannelTransaction.batch_id == batch_id
    ).all()
    
    internal_orders = db.query(models.InternalOrder).filter(
        models.InternalOrder.batch_id == batch_id
    ).all()
    
    matched_count = 0
    discrepancy_count = 0
    
    channel_map = {t.order_no: t for t in channel_transactions}
    internal_map = {o.order_no: o for o in internal_orders}
    
    all_order_nos = set(channel_map.keys()) | set(internal_map.keys())
    
    for order_no in all_order_nos:
        channel_txn = channel_map.get(order_no)
        internal_order = internal_map.get(order_no)
        
        if channel_txn and internal_order:
            if abs(channel_txn.amount - internal_order.amount) < 0.01:
                matched_count += 1
            else:
                discrepancy_count += 1
                _create_discrepancy(
                    db, batch_id, DiscrepancyType.AMOUNT_MISMATCH,
                    f"订单 {order_no} 金额不匹配",
                    expected_amount=internal_order.amount,
                    actual_amount=channel_txn.amount,
                    channel_txn_id=channel_txn.id,
                    internal_order_id=internal_order.id
                )
        elif channel_txn and not internal_order:
            discrepancy_count += 1
            _create_discrepancy(
                db, batch_id, DiscrepancyType.MISSING_INTERNAL,
                f"订单 {order_no} 缺失内部订单",
                actual_amount=channel_txn.amount,
                channel_txn_id=channel_txn.id
            )
        elif internal_order and not channel_txn:
            discrepancy_count += 1
            _create_discrepancy(
                db, batch_id, DiscrepancyType.MISSING_CHANNEL,
                f"订单 {order_no} 缺失渠道流水",
                expected_amount=internal_order.amount,
                internal_order_id=internal_order.id
            )
    
    batch.total_channel_count = len(channel_transactions)
    batch.total_channel_amount = sum(t.amount for t in channel_transactions)
    batch.total_internal_count = len(internal_orders)
    batch.total_internal_amount = sum(o.amount for o in internal_orders)
    batch.matched_count = matched_count
    batch.discrepancy_count = discrepancy_count
    
    if discrepancy_count == 0:
        batch.status = ReconciliationStatus.MATCHED
        crud.create_history_record(
            db, ActionType.RECONCILE, "success",
            f"对账完成，全部匹配: {matched_count} 笔",
            batch_id=batch_id
        )
    else:
        batch.status = ReconciliationStatus.DISCREPANCY
        crud.create_history_record(
            db, ActionType.RECONCILE, "warning",
            f"对账完成，匹配: {matched_count} 笔，差异: {discrepancy_count} 笔",
            batch_id=batch_id
        )
    
    db.commit()
    db.refresh(batch)
    return matched_count, discrepancy_count


def _create_discrepancy(
    db: Session,
    batch_id: int,
    discrepancy_type: DiscrepancyType,
    description: str,
    expected_amount: float = None,
    actual_amount: float = None,
    channel_txn_id: int = None,
    internal_order_id: int = None
):
    discrepancy = models.Discrepancy(
        batch_id=batch_id,
        discrepancy_type=discrepancy_type,
        description=description,
        expected_amount=expected_amount,
        actual_amount=actual_amount,
        channel_transaction_id=channel_txn_id,
        internal_order_id=internal_order_id,
        status=ReconciliationStatus.DISCREPANCY
    )
    db.add(discrepancy)
    db.commit()
    db.refresh(discrepancy)
    
    crud.create_history_record(
        db, ActionType.RECONCILE, "discrepancy",
        f"发现差异: {description}",
        batch_id=batch_id,
        discrepancy_id=discrepancy.id
    )
    return discrepancy


def generate_mock_data(
    db: Session,
    batch_no: str,
    channel: str,
    reconciliation_date: datetime,
    channel_count: int = 10,
    internal_count: int = 10,
    discrepancy_rate: float = 0.2
):
    existing = crud.get_batch_by_no(db, batch_no)
    if existing:
        return None, "批次号已存在"
    
    batch_create = schemas.ReconciliationBatchCreate(
        batch_no=batch_no,
        channel=channel,
        reconciliation_date=reconciliation_date
    )
    batch = crud.create_batch(db, batch_create)
    
    for i in range(channel_count):
        order_no = f"ORD{batch_no.split('-')[-1]}{i:03d}"
        amount = 100.0 + i * 10
        if i < int(channel_count * discrepancy_rate):
            amount += 5.0
        
        txn_create = schemas.ChannelTransactionCreate(
            transaction_id=f"TXN{batch_no.split('-')[-1]}{i:03d}",
            channel=channel,
            amount=amount,
            transaction_time=reconciliation_date,
            status="success",
            order_no=order_no,
            raw_data=json.dumps({"mock": True, "index": i})
        )
        crud.create_channel_transaction(db, txn_create, batch.id)
    
    for i in range(internal_count):
        order_no = f"ORD{batch_no.split('-')[-1]}{i:03d}"
        amount = 100.0 + i * 10
        
        order_create = schemas.InternalOrderCreate(
            order_no=order_no,
            amount=amount,
            status="paid",
            payment_method=channel,
            created_time=reconciliation_date,
            paid_time=reconciliation_date,
            raw_data=json.dumps({"mock": True, "index": i})
        )
        crud.create_internal_order(db, order_create, batch.id)
    
    crud.create_history_record(
        db, ActionType.IMPORT, "success",
        f"导入模拟数据: 渠道流水 {channel_count} 笔, 内部订单 {internal_count} 笔",
        batch_id=batch.id
    )
    
    return batch, None
