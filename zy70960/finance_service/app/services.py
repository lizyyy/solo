from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from typing import List, Optional, Tuple
from . import models, schemas
from .parser import parse_deposit_csv, parse_sales_json, parse_petty_cash_csv


def create_batch(db: Session, batch: schemas.BatchCreate) -> models.Batch:
    db_batch = models.Batch(
        batch_no=batch.batch_no,
        store_code=batch.store_code,
        batch_type=batch.batch_type,
        source_file=batch.source_file,
        created_by=batch.created_by,
        remarks=batch.remarks,
        status="pending"
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)

    _add_process_log(
        db=db,
        batch_id=db_batch.id,
        action="create",
        action_type="batch_create",
        reason=f"创建批次: {batch.batch_no}",
        handled_by=batch.created_by or "system",
        old_status=None,
        new_status="pending",
        remarks=batch.remarks
    )

    return db_batch


def upload_batch_file(db: Session, batch_id: int, file_content: bytes, filename: str) -> Tuple[models.Batch, int]:
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise ValueError(f"批次不存在: {batch_id}")

    record_count = 0

    if batch.batch_type == "deposit":
        records = parse_deposit_csv(file_content, batch_id)
        for record in records:
            db_record = models.DepositRecord(**record.model_dump())
            db.add(db_record)
            record_count += 1
    elif batch.batch_type == "sales":
        records = parse_sales_json(file_content, batch_id)
        for record in records:
            db_record = models.SalesRecord(**record.model_dump())
            db.add(db_record)
            record_count += 1
    elif batch.batch_type == "petty_cash":
        records = parse_petty_cash_csv(file_content, batch_id)
        for record in records:
            db_record = models.PettyCashRecord(**record.model_dump())
            db.add(db_record)
            record_count += 1
    else:
        raise ValueError(f"不支持的批次类型: {batch.batch_type}")

    batch.record_count = record_count
    batch.source_file = filename
    batch.status = "processing"
    db.commit()
    db.refresh(batch)

    _add_process_log(
        db=db,
        batch_id=batch.id,
        action="upload",
        action_type="file_upload",
        reason=f"上传文件: {filename}, 共 {record_count} 条记录",
        handled_by=batch.created_by or "system",
        old_status="pending",
        new_status="processing"
    )

    return batch, record_count


def detect_anomalies(db: Session, batch_id: int) -> List[dict]:
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch or batch.batch_type != "deposit":
        return []

    anomalies = []
    deposit_records = db.query(models.DepositRecord).filter(
        models.DepositRecord.batch_id == batch_id
    ).all()

    for record in deposit_records:
        if record.deposit_slip_no:
            duplicates = db.query(models.DepositRecord).filter(
                and_(
                    models.DepositRecord.deposit_slip_no == record.deposit_slip_no,
                    models.DepositRecord.id != record.id
                )
            ).all()
            if duplicates:
                record.is_duplicate = True
                record.status = "returned"
                record.mismatch_reason = f"重复缴存，与记录ID {[d.id for d in duplicates]} 重复"
                anomalies.append({
                    "record_id": record.id,
                    "type": "duplicate",
                    "reason": record.mismatch_reason
                })

        if record.deposit_date.weekday() >= 5:
            record.is_holiday_delay = True
            anomalies.append({
                "record_id": record.id,
                "type": "holiday_delay",
                "reason": "周末/节假日缴存，可能延迟到账"
            })

    db.commit()
    return anomalies


def reconcile_deposits_with_sales(db: Session, batch_id: int) -> List[dict]:
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        return []

    results = []
    deposit_records = db.query(models.DepositRecord).filter(
        models.DepositRecord.batch_id == batch_id
    ).all()

    for deposit in deposit_records:
        sales_amount = db.query(models.SalesRecord).filter(
            and_(
                models.SalesRecord.store_code == deposit.store_code,
                models.SalesRecord.sale_date >= deposit.deposit_date.replace(hour=0, minute=0, second=0),
                models.SalesRecord.sale_date <= deposit.deposit_date.replace(hour=23, minute=59, second=59)
            )
        ).all()

        total_sales = sum(s.sale_amount for s in sales_amount if s.payment_method == "cash")
        diff = deposit.deposit_amount - total_sales

        if abs(diff) > 0.01:
            if diff > 0:
                deposit.status = "over"
                deposit.mismatch_reason = f"长款 {diff:.2f} 元，销售现金 {total_sales:.2f} 元，实际缴存 {deposit.deposit_amount:.2f} 元"
            else:
                deposit.status = "short"
                deposit.mismatch_reason = f"短款 {abs(diff):.2f} 元，销售现金 {total_sales:.2f} 元，实际缴存 {deposit.deposit_amount:.2f} 元"

            results.append({
                "record_id": deposit.id,
                "type": "overage" if diff > 0 else "shortage",
                "difference": diff,
                "sales_amount": total_sales,
                "deposit_amount": deposit.deposit_amount,
                "reason": deposit.mismatch_reason
            })
        elif deposit.status == "pending":
            deposit.status = "matched"

    db.commit()
    return results


def process_records(db: Session, request: schemas.ProcessActionRequest) -> int:
    processed_count = 0
    action_map = {
        "approve": "resolved",
        "return": "returned",
        "pending": "pending",
        "matched": "matched"
    }

    for record_id in request.record_ids:
        record = db.query(models.DepositRecord).filter(models.DepositRecord.id == record_id).first()
        if not record:
            continue

        old_status = record.status
        new_status = action_map.get(request.action, request.action)

        record.status = new_status
        record.handled_by = request.handled_by
        record.handled_at = datetime.utcnow()

        if request.action_type:
            if request.action_type == "duplicate":
                record.is_duplicate = True
            elif request.action_type == "holiday_delay":
                record.is_holiday_delay = True

        if request.remarks:
            record.remarks = (record.remarks or "") + f"\n[{datetime.utcnow()}] {request.remarks}"

        _add_process_log(
            db=db,
            batch_id=record.batch_id,
            deposit_record_id=record.id,
            action=request.action,
            action_type=request.action_type,
            reason=request.reason,
            handled_by=request.handled_by,
            old_status=old_status,
            new_status=new_status,
            remarks=request.remarks
        )

        processed_count += 1

    db.commit()
    return processed_count


def return_batch(db: Session, batch_id: int, reason: str, handled_by: str, remarks: Optional[str] = None) -> models.Batch:
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not batch:
        raise ValueError(f"批次不存在: {batch_id}")

    old_status = batch.status
    batch.status = "returned"

    _add_process_log(
        db=db,
        batch_id=batch.id,
        action="return",
        action_type="batch_return",
        reason=reason,
        handled_by=handled_by,
        old_status=old_status,
        new_status="returned",
        remarks=remarks
    )

    db.commit()
    db.refresh(batch)
    return batch


def query_records(db: Session, params: schemas.QueryParams) -> Tuple[List, int]:
    query = db.query(models.DepositRecord)
    filters = []

    if params.store_code:
        filters.append(models.DepositRecord.store_code == params.store_code)
    if params.status:
        filters.append(models.DepositRecord.status == params.status)
    if params.start_date:
        filters.append(models.DepositRecord.deposit_date >= params.start_date)
    if params.end_date:
        filters.append(models.DepositRecord.deposit_date <= params.end_date)
    if params.batch_no:
        batch = db.query(models.Batch).filter(models.Batch.batch_no == params.batch_no).first()
        if batch:
            filters.append(models.DepositRecord.batch_id == batch.id)

    if filters:
        query = query.filter(and_(*filters))

    total = query.count()

    offset = (params.page - 1) * params.page_size
    records = query.order_by(models.DepositRecord.deposit_date.desc()) \
        .offset(offset) \
        .limit(params.page_size) \
        .all()

    return records, total


def query_petty_cash(db: Session, params: schemas.QueryParams) -> Tuple[List, int]:
    query = db.query(models.PettyCashRecord)
    filters = []

    if params.store_code:
        filters.append(models.PettyCashRecord.store_code == params.store_code)
    if params.account_no:
        filters.append(models.PettyCashRecord.account_no == params.account_no)
    if params.status:
        filters.append(models.PettyCashRecord.status == params.status)
    if params.start_date:
        filters.append(models.PettyCashRecord.trans_date >= params.start_date)
    if params.end_date:
        filters.append(models.PettyCashRecord.trans_date <= params.end_date)

    if filters:
        query = query.filter(and_(*filters))

    total = query.count()

    offset = (params.page - 1) * params.page_size
    records = query.order_by(models.PettyCashRecord.trans_date.desc()) \
        .offset(offset) \
        .limit(params.page_size) \
        .all()

    return records, total


def query_batches(db: Session, params: schemas.QueryParams) -> Tuple[List[models.Batch], int]:
    query = db.query(models.Batch)
    filters = []

    if params.store_code:
        filters.append(models.Batch.store_code == params.store_code)
    if params.batch_no:
        filters.append(models.Batch.batch_no.like(f"%{params.batch_no}%"))
    if params.status:
        filters.append(models.Batch.status == params.status)

    if filters:
        query = query.filter(and_(*filters))

    total = query.count()

    offset = (params.page - 1) * params.page_size
    batches = query.order_by(models.Batch.created_at.desc()) \
        .offset(offset) \
        .limit(params.page_size) \
        .all()

    return batches, total


def get_batch_detail(db: Session, batch_id: int) -> Optional[models.Batch]:
    return db.query(models.Batch).filter(models.Batch.id == batch_id).first()


def get_process_logs(db: Session, batch_id: Optional[int] = None, deposit_record_id: Optional[int] = None) -> List[models.ProcessLog]:
    query = db.query(models.ProcessLog)

    if batch_id:
        query = query.filter(models.ProcessLog.batch_id == batch_id)
    if deposit_record_id:
        query = query.filter(models.ProcessLog.deposit_record_id == deposit_record_id)

    return query.order_by(models.ProcessLog.handled_at.desc()).all()


def _add_process_log(db: Session, **kwargs):
    log = models.ProcessLog(**kwargs)
    db.add(log)
    db.flush()


def record_to_dict(record) -> dict:
    result = {}
    for column in record.__table__.columns:
        value = getattr(record, column.name)
        if isinstance(value, datetime):
            result[column.name] = value.isoformat()
        else:
            result[column.name] = value
    return result
