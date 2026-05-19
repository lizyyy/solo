from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from . import models, schemas
from .models import ReconciliationStatus, ActionType


def create_history_record(
    db: Session,
    action_type: ActionType,
    status: str,
    details: str,
    operator: str = "system",
    batch_id: Optional[int] = None,
    discrepancy_id: Optional[int] = None,
    error_message: Optional[str] = None
):
    db_history = models.ProcessingHistory(
        batch_id=batch_id,
        discrepancy_id=discrepancy_id,
        action_type=action_type,
        status=status,
        operator=operator,
        details=details,
        error_message=error_message
    )
    db.add(db_history)
    db.commit()
    db.refresh(db_history)
    return db_history


def create_batch(db: Session, batch: schemas.ReconciliationBatchCreate):
    db_batch = models.ReconciliationBatch(**batch.dict())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    create_history_record(
        db,
        action_type=ActionType.IMPORT,
        status="created",
        details=f"创建对账批次: {batch.batch_no}",
        batch_id=db_batch.id
    )
    return db_batch


def get_batch(db: Session, batch_id: int):
    return db.query(models.ReconciliationBatch).filter(models.ReconciliationBatch.id == batch_id).first()


def get_batch_by_no(db: Session, batch_no: str):
    return db.query(models.ReconciliationBatch).filter(models.ReconciliationBatch.batch_no == batch_no).first()


def get_batches(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[ReconciliationStatus] = None,
    channel: Optional[str] = None
):
    query = db.query(models.ReconciliationBatch)
    if status:
        query = query.filter(models.ReconciliationBatch.status == status)
    if channel:
        query = query.filter(models.ReconciliationBatch.channel == channel)
    return query.order_by(desc(models.ReconciliationBatch.created_at)).offset(skip).limit(limit).all()


def update_batch_status(
    db: Session,
    batch_id: int,
    status: ReconciliationStatus,
    error_message: Optional[str] = None
):
    db_batch = get_batch(db, batch_id)
    if db_batch:
        old_status = db_batch.status
        db_batch.status = status
        if error_message:
            db_batch.error_message = error_message
        db_batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_batch)
        create_history_record(
            db,
            action_type=ActionType.RECONCILE,
            status=status.value,
            details=f"状态变更: {old_status.value} -> {status.value}",
            batch_id=batch_id,
            error_message=error_message
        )
    return db_batch


def create_channel_transaction(db: Session, transaction: schemas.ChannelTransactionCreate, batch_id: int):
    db_transaction = models.ChannelTransaction(**transaction.dict(), batch_id=batch_id)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


def create_internal_order(db: Session, order: schemas.InternalOrderCreate, batch_id: int):
    db_order = models.InternalOrder(**order.dict(), batch_id=batch_id)
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


def get_discrepancies(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[ReconciliationStatus] = None,
    batch_id: Optional[int] = None
):
    query = db.query(models.Discrepancy)
    if status:
        query = query.filter(models.Discrepancy.status == status)
    if batch_id:
        query = query.filter(models.Discrepancy.batch_id == batch_id)
    return query.order_by(desc(models.Discrepancy.created_at)).offset(skip).limit(limit).all()


def get_discrepancy(db: Session, discrepancy_id: int):
    return db.query(models.Discrepancy).filter(models.Discrepancy.id == discrepancy_id).first()


def resolve_discrepancy(db: Session, discrepancy_id: int, note: str, operator: str = "manual"):
    db_discrepancy = get_discrepancy(db, discrepancy_id)
    if db_discrepancy:
        old_status = db_discrepancy.status
        db_discrepancy.status = ReconciliationStatus.RESOLVED
        db_discrepancy.resolved_note = note
        db_discrepancy.resolved_at = datetime.utcnow()
        db.commit()
        db.refresh(db_discrepancy)
        
        create_history_record(
            db,
            action_type=ActionType.MARK_RESOLVED,
            status=ReconciliationStatus.RESOLVED.value,
            operator=operator,
            details=f"差异处理: {old_status.value} -> resolved, 备注: {note}",
            discrepancy_id=discrepancy_id,
            batch_id=db_discrepancy.batch_id
        )
        
        batch = get_batch(db, db_discrepancy.batch_id)
        if batch:
            remaining = db.query(models.Discrepancy).filter(
                models.Discrepancy.batch_id == batch.id,
                models.Discrepancy.status == ReconciliationStatus.DISCREPANCY
            ).count()
            if remaining == 0:
                update_batch_status(db, batch.id, ReconciliationStatus.RESOLVED)
    
    return db_discrepancy


def get_history(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    batch_id: Optional[int] = None,
    discrepancy_id: Optional[int] = None
):
    query = db.query(models.ProcessingHistory)
    if batch_id:
        query = query.filter(models.ProcessingHistory.batch_id == batch_id)
    if discrepancy_id:
        query = query.filter(models.ProcessingHistory.discrepancy_id == discrepancy_id)
    return query.order_by(desc(models.ProcessingHistory.created_at)).offset(skip).limit(limit).all()


def get_batch_statistics(db: Session):
    total = db.query(models.ReconciliationBatch).count()
    pending = db.query(models.ReconciliationBatch).filter(models.ReconciliationBatch.status == ReconciliationStatus.PENDING).count()
    processing = db.query(models.ReconciliationBatch).filter(models.ReconciliationBatch.status == ReconciliationStatus.PROCESSING).count()
    matched = db.query(models.ReconciliationBatch).filter(models.ReconciliationBatch.status == ReconciliationStatus.MATCHED).count()
    discrepancy = db.query(models.ReconciliationBatch).filter(models.ReconciliationBatch.status == ReconciliationStatus.DISCREPANCY).count()
    resolved = db.query(models.ReconciliationBatch).filter(models.ReconciliationBatch.status == ReconciliationStatus.RESOLVED).count()
    failed = db.query(models.ReconciliationBatch).filter(models.ReconciliationBatch.status == ReconciliationStatus.FAILED).count()
    return {
        "total_batches": total,
        "pending_batches": pending,
        "processing_batches": processing,
        "matched_batches": matched,
        "discrepancy_batches": discrepancy,
        "resolved_batches": resolved,
        "failed_batches": failed
    }


def get_discrepancy_statistics(db: Session):
    total = db.query(models.Discrepancy).count()
    by_type = {}
    for d_type in models.DiscrepancyType:
        count = db.query(models.Discrepancy).filter(models.Discrepancy.discrepancy_type == d_type).count()
        by_type[d_type.value] = count
    return {
        "total_discrepancies": total,
        "by_type": by_type
    }
