from sqlalchemy.orm import Session
from sqlalchemy import desc
import json
import uuid
from datetime import datetime
from typing import List, Optional

import models
import schemas


def get_cabinet_by_no(db: Session, cabinet_no: str):
    return db.query(models.Cabinet).filter(models.Cabinet.cabinet_no == cabinet_no).first()


def create_cabinet(db: Session, cabinet: schemas.CabinetCreate):
    db_cabinet = models.Cabinet(**cabinet.dict())
    db.add(db_cabinet)
    db.commit()
    db.refresh(db_cabinet)
    return db_cabinet


def get_cabinets(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Cabinet).offset(skip).limit(limit).all()


def get_sku_by_code(db: Session, cabinet_id: int, sku_code: str):
    return db.query(models.SKUStock).filter(
        models.SKUStock.cabinet_id == cabinet_id,
        models.SKUStock.sku_code == sku_code
    ).first()


def create_sku_stock(db: Session, sku: schemas.SKUStockCreate, cabinet_id: int):
    db_sku = models.SKUStock(**sku.dict(), cabinet_id=cabinet_id)
    db.add(db_sku)
    db.commit()
    db.refresh(db_sku)
    return db_sku


def get_sku_stocks(db: Session, cabinet_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.SKUStock).filter(
        models.SKUStock.cabinet_id == cabinet_id
    ).offset(skip).limit(limit).all()


def get_replenishment_by_batch_no(db: Session, batch_no: str):
    return db.query(models.ReplenishmentBatch).filter(
        models.ReplenishmentBatch.batch_no == batch_no
    ).first()


def get_replenishment_by_idempotent_key(db: Session, idempotent_key: str):
    if not idempotent_key:
        return None
    return db.query(models.ReplenishmentBatch).filter(
        models.ReplenishmentBatch.idempotent_key == idempotent_key
    ).first()


def take_inventory_snapshot(db: Session, batch_id: int, cabinet_no: str, snapshot_type: str, inventory_data: dict):
    snapshot = models.InventorySnapshot(
        batch_id=batch_id,
        cabinet_no=cabinet_no,
        snapshot_type=snapshot_type,
        snapshot_data=json.dumps(inventory_data, ensure_ascii=False)
    )
    db.add(snapshot)
    db.commit()
    return snapshot


def create_replenishment_batch(db: Session, batch: schemas.ReplenishmentBatchCreate):
    cabinet = get_cabinet_by_no(db, batch.cabinet_no)
    if not cabinet:
        cabinet = create_cabinet(db, schemas.CabinetCreate(
            cabinet_no=batch.cabinet_no,
            location=f"位置-{batch.cabinet_no}"
        ))

    existing_batch = get_replenishment_by_batch_no(db, batch.batch_no)
    if existing_batch:
        return existing_batch, False

    if batch.idempotent_key:
        existing_by_key = get_replenishment_by_idempotent_key(db, batch.idempotent_key)
        if existing_by_key:
            return existing_by_key, False

    db_batch = models.ReplenishmentBatch(
        batch_no=batch.batch_no,
        cabinet_id=cabinet.id,
        operator_id=batch.operator_id,
        operator_name=batch.operator_name,
        idempotent_key=batch.idempotent_key,
        status="created"
    )
    db.add(db_batch)
    db.flush()

    before_inventory = {}
    for item in batch.items:
        sku = get_sku_by_code(db, cabinet.id, item.sku_code)
        if sku:
            before_qty = sku.current_quantity
            before_inventory[item.sku_code] = {
                "name": sku.sku_name,
                "quantity": before_qty,
                "price": sku.unit_price
            }
        else:
            before_qty = 0
            before_inventory[item.sku_code] = {
                "name": item.sku_name,
                "quantity": before_qty,
                "price": item.unit_price
            }

        after_qty = before_qty + item.replenish_quantity
        db_item = models.ReplenishmentItem(
            batch_id=db_batch.id,
            sku_code=item.sku_code,
            sku_name=item.sku_name,
            replenish_quantity=item.replenish_quantity,
            unit_price=item.unit_price,
            before_quantity=before_qty,
            after_quantity=after_qty,
            expiration_date=item.expiration_date
        )
        db.add(db_item)

        if sku:
            sku.current_quantity = after_qty
            if item.expiration_date:
                sku.expiration_date = item.expiration_date
        else:
            new_sku = models.SKUStock(
                cabinet_id=cabinet.id,
                sku_code=item.sku_code,
                sku_name=item.sku_name,
                current_quantity=after_qty,
                unit_price=item.unit_price,
                expiration_date=item.expiration_date
            )
            db.add(new_sku)

    take_inventory_snapshot(db, db_batch.id, batch.cabinet_no, "before", before_inventory)

    if batch.damages:
        for damage in batch.damages:
            total_amount = damage.quantity * damage.unit_price
            db_damage = models.DamageRecord(
                batch_id=db_batch.id,
                sku_code=damage.sku_code,
                sku_name=damage.sku_name,
                damage_type=damage.damage_type,
                quantity=damage.quantity,
                unit_price=damage.unit_price,
                total_amount=total_amount,
                reason=damage.reason
            )
            db.add(db_damage)

    if batch.expired_removals:
        for expired in batch.expired_removals:
            total_amount = expired.quantity * expired.unit_price
            db_expired = models.ExpiredRemoval(
                batch_id=db_batch.id,
                sku_code=expired.sku_code,
                sku_name=expired.sku_name,
                quantity=expired.quantity,
                unit_price=expired.unit_price,
                total_amount=total_amount,
                expiration_date=expired.expiration_date
            )
            db.add(db_expired)

            sku = get_sku_by_code(db, cabinet.id, expired.sku_code)
            if sku:
                sku.current_quantity = max(0, sku.current_quantity - expired.quantity)

    db.commit()
    db.refresh(db_batch)
    return db_batch, True


def get_replenishment_batches(db: Session, cabinet_no: Optional[str] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.ReplenishmentBatch)
    if cabinet_no:
        cabinet = get_cabinet_by_no(db, cabinet_no)
        if cabinet:
            query = query.filter(models.ReplenishmentBatch.cabinet_id == cabinet.id)
    return query.order_by(desc(models.ReplenishmentBatch.created_at)).offset(skip).limit(limit).all()


def update_replenishment_status(db: Session, batch_no: str, status_update: schemas.StatusUpdate):
    batch = get_replenishment_by_batch_no(db, batch_no)
    if not batch:
        return None

    valid_statuses = ["created", "confirmed", "settled", "cancelled"]
    if status_update.status not in valid_statuses:
        raise ValueError(f"无效状态，有效状态: {valid_statuses}")

    if status_update.operator_id and status_update.status == "confirmed":
        confirmation = models.OperatorConfirmation(
            batch_id=batch.id,
            operator_id=status_update.operator_id,
            operator_name=status_update.operator_id,
            confirm_type="replenishment",
            remark=status_update.remark
        )
        db.add(confirmation)

    batch.status = status_update.status
    db.commit()
    db.refresh(batch)
    return batch


def create_settlement(db: Session, settlement: schemas.SettlementSummaryCreate):
    cabinet = get_cabinet_by_no(db, settlement.cabinet_no)
    if not cabinet:
        return None

    batch = get_replenishment_by_batch_no(db, settlement.batch_no)
    if not batch:
        return None

    existing = db.query(models.SettlementSummary).filter(
        models.SettlementSummary.batch_id == batch.id
    ).first()
    if existing:
        return existing

    replenish_amount = sum(
        item.replenish_quantity * item.unit_price
        for item in batch.items
    )

    damage_amount = sum(
        d.total_amount for d in batch.damages
    )

    expired_amount = db.query(models.ExpiredRemoval).filter(
        models.ExpiredRemoval.batch_id == batch.id
    ).with_entities(models.ExpiredRemoval.total_amount).all()
    expired_total = sum(e[0] for e in expired_amount)

    final_amount = replenish_amount - damage_amount - expired_total

    db_settlement = models.SettlementSummary(
        settlement_no=settlement.settlement_no,
        cabinet_id=cabinet.id,
        batch_id=batch.id,
        total_replenishment_amount=replenish_amount,
        total_damage_amount=damage_amount,
        total_expired_amount=expired_total,
        final_settlement_amount=final_amount,
        status="completed"
    )
    db.add(db_settlement)

    batch.status = "settled"
    db.commit()
    db.refresh(db_settlement)
    return db_settlement


def get_settlements(db: Session, cabinet_no: Optional[str] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.SettlementSummary)
    if cabinet_no:
        cabinet = get_cabinet_by_no(db, cabinet_no)
        if cabinet:
            query = query.filter(models.SettlementSummary.cabinet_id == cabinet.id)
    return query.order_by(desc(models.SettlementSummary.created_at)).offset(skip).limit(limit).all()


def log_exception(db: Session, endpoint: str, raw_input: str, error_message: str, processing_result: str):
    log = models.ExceptionLog(
        request_id=str(uuid.uuid4()),
        endpoint=endpoint,
        raw_input=raw_input,
        error_message=error_message,
        processing_result=processing_result
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_exception_logs(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ExceptionLog).order_by(
        desc(models.ExceptionLog.created_at)
    ).offset(skip).limit(limit).all()


def create_manual_correction(db: Session, correction: schemas.ManualCorrectionCreate):
    target_model = None
    if correction.target_type == "sku_stock":
        target_model = models.SKUStock
    elif correction.target_type == "replenishment_item":
        target_model = models.ReplenishmentItem
    elif correction.target_type == "damage_record":
        target_model = models.DamageRecord

    if not target_model:
        raise ValueError(f"不支持的修正类型: {correction.target_type}")

    target = db.query(target_model).filter(target_model.id == correction.target_id).first()
    if not target:
        return None

    before_data = {}
    for column in target.__table__.columns:
        value = getattr(target, column.name)
        if isinstance(value, datetime):
            before_data[column.name] = value.isoformat()
        else:
            before_data[column.name] = value

    for key, value in correction.correction_data.items():
        if hasattr(target, key):
            setattr(target, key, value)

    after_data = {}
    for column in target.__table__.columns:
        value = getattr(target, column.name)
        if isinstance(value, datetime):
            after_data[column.name] = value.isoformat()
        else:
            after_data[column.name] = value

    db_correction = models.ManualCorrection(
        target_type=correction.target_type,
        target_id=correction.target_id,
        operator_id=correction.operator_id,
        operator_name=correction.operator_name,
        before_data=json.dumps(before_data, ensure_ascii=False),
        after_data=json.dumps(after_data, ensure_ascii=False),
        reason=correction.reason
    )
    db.add(db_correction)
    db.commit()
    db.refresh(db_correction)
    return db_correction


def get_manual_corrections(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ManualCorrection).order_by(
        desc(models.ManualCorrection.created_at)
    ).offset(skip).limit(limit).all()


def export_settlement_data(db: Session, settlement_no: str):
    settlement = db.query(models.SettlementSummary).filter(
        models.SettlementSummary.settlement_no == settlement_no
    ).first()
    if not settlement:
        return None

    cabinet = db.query(models.Cabinet).filter(
        models.Cabinet.id == settlement.cabinet_id
    ).first()

    batch = db.query(models.ReplenishmentBatch).filter(
        models.ReplenishmentBatch.id == settlement.batch_id
    ).first()

    items = db.query(models.ReplenishmentItem).filter(
        models.ReplenishmentItem.batch_id == settlement.batch_id
    ).all()

    damages = db.query(models.DamageRecord).filter(
        models.DamageRecord.batch_id == settlement.batch_id
    ).all()

    expired = db.query(models.ExpiredRemoval).filter(
        models.ExpiredRemoval.batch_id == settlement.batch_id
    ).all()

    confirmations = db.query(models.OperatorConfirmation).filter(
        models.OperatorConfirmation.batch_id == settlement.batch_id
    ).all()

    return {
        "settlement": {
            "settlement_no": settlement.settlement_no,
            "cabinet_no": cabinet.cabinet_no if cabinet else None,
            "batch_no": batch.batch_no if batch else None,
            "total_replenishment_amount": settlement.total_replenishment_amount,
            "total_damage_amount": settlement.total_damage_amount,
            "total_expired_amount": settlement.total_expired_amount,
            "final_settlement_amount": settlement.final_settlement_amount,
            "status": settlement.status,
            "created_at": settlement.created_at.isoformat()
        },
        "replenishment_items": [
            {
                "sku_code": item.sku_code,
                "sku_name": item.sku_name,
                "replenish_quantity": item.replenish_quantity,
                "unit_price": item.unit_price,
                "before_quantity": item.before_quantity,
                "after_quantity": item.after_quantity
            } for item in items
        ],
        "damage_records": [
            {
                "sku_code": d.sku_code,
                "sku_name": d.sku_name,
                "damage_type": d.damage_type,
                "quantity": d.quantity,
                "unit_price": d.unit_price,
                "total_amount": d.total_amount,
                "reason": d.reason
            } for d in damages
        ],
        "expired_removals": [
            {
                "sku_code": e.sku_code,
                "sku_name": e.sku_name,
                "quantity": e.quantity,
                "unit_price": e.unit_price,
                "total_amount": e.total_amount
            } for e in expired
        ],
        "confirmations": [
            {
                "operator_id": c.operator_id,
                "operator_name": c.operator_name,
                "confirm_type": c.confirm_type,
                "remark": c.remark,
                "confirmed_at": c.confirmed_at.isoformat()
            } for c in confirmations
        ]
    }
