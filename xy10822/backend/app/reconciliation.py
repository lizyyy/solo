import json
import random
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
    
    refunds = db.query(models.RefundRecord).filter(
        models.RefundRecord.batch_id == batch_id
    ).all()
    
    matched_count = 0
    discrepancy_count = 0
    
    channel_map = {t.order_no: t for t in channel_transactions}
    internal_map = {o.order_no: o for o in internal_orders}
    refund_map = {r.order_no: r for r in refunds}
    
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
    
    for order_no, refund in refund_map.items():
        channel_refund_id = refund.channel_refund_id
        if channel_refund_id:
            channel_refund_exists = any(
                r.channel_refund_id == channel_refund_id 
                for r in refund_map.values() 
                if r.order_no != order_no
            )
        else:
            channel_refund_exists = False
        
        if order_no in internal_map:
            expected_refund_amount = internal_map[order_no].amount * 0.1
            if abs(refund.amount - expected_refund_amount) > 0.01:
                discrepancy_count += 1
                _create_discrepancy(
                    db, batch_id, DiscrepancyType.REFUND_MISMATCH,
                    f"订单 {order_no} 退款金额不匹配",
                    expected_amount=expected_refund_amount,
                    actual_amount=refund.amount
                )
        else:
            discrepancy_count += 1
            _create_discrepancy(
                db, batch_id, DiscrepancyType.REFUND_MISMATCH,
                f"退款 {refund.refund_id} 对应的订单 {order_no} 不存在于内部系统",
                actual_amount=refund.amount
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
            f"对账完成，全部匹配: {matched_count} 笔，退款: {len(refunds)} 笔",
            batch_id=batch_id
        )
    else:
        batch.status = ReconciliationStatus.DISCREPANCY
        crud.create_history_record(
            db, ActionType.RECONCILE, "warning",
            f"对账完成，匹配: {matched_count} 笔，差异: {discrepancy_count} 笔，退款: {len(refunds)} 笔",
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
    
    for i in range(min(5, int(channel_count * 0.2))):
        order_no = f"ORD{batch_no.split('-')[-1]}{i:03d}"
        refund_amount = random.uniform(10, 50)
        
        refund_create = schemas.RefundRecordCreate(
            refund_id=f"REF{batch_no.split('-')[-1]}{i:03d}",
            order_no=order_no,
            amount=refund_amount,
            status="success",
            refund_time=reconciliation_date,
            channel_refund_id=f"CHREF{batch_no.split('-')[-1]}{i:03d}",
            raw_data=json.dumps({"mock": True, "index": i})
        )
        db_refund = models.RefundRecord(**refund_create.dict(), batch_id=batch.id)
        db.add(db_refund)
    
    db.commit()
    
    crud.create_history_record(
        db, ActionType.IMPORT, "success",
        f"导入模拟数据: 渠道流水 {channel_count} 笔, 内部订单 {internal_count} 笔, 退款记录 {min(5, int(channel_count * 0.2))} 笔",
        batch_id=batch.id
    )
    
    return batch, None


def fetch_mock_internal_orders(
    db: Session,
    batch_id: int,
    count: int = 20
) -> int:
    batch = crud.get_batch(db, batch_id)
    if not batch:
        return 0
    
    existing_orders = db.query(models.InternalOrder).filter(
        models.InternalOrder.batch_id == batch_id
    ).all()
    existing_order_nos = {o.order_no for o in existing_orders}
    
    added_count = 0
    for i in range(count):
        order_no = f"ORDFETCH{batch_id:03d}{i:03d}"
        if order_no in existing_order_nos:
            continue
        
        amount = round(random.uniform(100, 1000), 2)
        
        order_create = schemas.InternalOrderCreate(
            order_no=order_no,
            amount=amount,
            status="paid",
            payment_method=batch.channel,
            created_time=batch.reconciliation_date,
            paid_time=batch.reconciliation_date,
            raw_data=json.dumps({"fetched": True, "index": i})
        )
        crud.create_internal_order(db, order_create, batch_id)
        added_count += 1
    
    return added_count


def fetch_mock_refunds(
    db: Session,
    batch_id: int,
    count: int = 5
) -> int:
    batch = crud.get_batch(db, batch_id)
    if not batch:
        return 0
    
    existing_orders = db.query(models.InternalOrder).filter(
        models.InternalOrder.batch_id == batch_id
    ).all()
    
    existing_refunds = db.query(models.RefundRecord).filter(
        models.RefundRecord.batch_id == batch_id
    ).all()
    existing_refund_ids = {r.refund_id for r in existing_refunds}
    
    added_count = 0
    for i in range(count):
        refund_id = f"REFFETCH{batch_id:03d}{i:03d}"
        if refund_id in existing_refund_ids:
            continue
        
        if existing_orders and i < len(existing_orders):
            order = existing_orders[i]
            order_no = order.order_no
            amount = round(order.amount * random.uniform(0.05, 0.2), 2)
        else:
            order_no = f"ORDFETCH{batch_id:03d}NONE{i:03d}"
            amount = round(random.uniform(50, 200), 2)
        
        refund_create = schemas.RefundRecordCreate(
            refund_id=refund_id,
            order_no=order_no,
            amount=amount,
            status="success",
            refund_time=batch.reconciliation_date,
            channel_refund_id=f"CHREFFETCH{batch_id:03d}{i:03d}",
            raw_data=json.dumps({"fetched": True, "index": i})
        )
        db_refund = models.RefundRecord(**refund_create.dict(), batch_id=batch_id)
        db.add(db_refund)
        added_count += 1
    
    db.commit()
    return added_count
