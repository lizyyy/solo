from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
import json
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

from database import engine, get_db, Base
import models
import schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(title="无人货柜库存快照货损补货结算API", version="1.0.0")


def log_operation(db: Session, operation_type: str, ref_no: str, original_input: dict,
                  operator_id: str, operator_name: str, conclusion: str,
                  status: str = "success", error_message: str = ""):
    import datetime
    def json_serializer(obj):
        if isinstance(obj, (datetime.datetime, datetime.date)):
            return obj.isoformat()
        raise TypeError(f"Type {type(obj)} not serializable")
    
    log = models.OperationLog(
        operation_type=operation_type,
        ref_no=ref_no,
        original_input=json.dumps(original_input, default=json_serializer, ensure_ascii=False),
        operator_id=operator_id,
        operator_name=operator_name,
        conclusion=conclusion,
        status=status,
        error_message=error_message
    )
    db.add(log)
    db.commit()


def raise_with_log(db: Session, operation_type: str, ref_no: str, original_input: dict,
                   operator_id: str, operator_name: str, error_detail: str, status_code: int = 400):
    """异常时记录操作日志后抛出异常"""
    log_operation(db, operation_type, ref_no, original_input,
                  operator_id, operator_name, error_detail, "failed", error_detail)
    raise HTTPException(status_code=status_code, detail=error_detail)


@app.get("/")
def root():
    return {"message": "无人货柜库存快照货损补货结算系统"}


@app.post("/cabinets/", response_model=schemas.CabinetResponse)
def create_cabinet(cabinet: schemas.CabinetCreate, db: Session = Depends(get_db)):
    original_input = cabinet.dict()
    db_cabinet = db.query(models.Cabinet).filter(
        models.Cabinet.cabinet_no == cabinet.cabinet_no
    ).first()
    if db_cabinet:
        raise_with_log(db, "create_cabinet", cabinet.cabinet_no, original_input,
                       "", "", "货柜编号已存在", 400)
    db_cabinet = models.Cabinet(**cabinet.dict())
    db.add(db_cabinet)
    db.commit()
    db.refresh(db_cabinet)
    log_operation(db, "create_cabinet", cabinet.cabinet_no, original_input,
                  "", "", "货柜创建成功", "success")
    return db_cabinet


@app.get("/cabinets/", response_model=List[schemas.CabinetResponse])
def list_cabinets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    cabinets = db.query(models.Cabinet).offset(skip).limit(limit).all()
    return cabinets


@app.post("/skus/", response_model=schemas.SKUResponse)
def create_sku(sku: schemas.SKUCreate, db: Session = Depends(get_db)):
    original_input = sku.dict()
    db_sku = db.query(models.SKU).filter(models.SKU.sku_code == sku.sku_code).first()
    if db_sku:
        raise_with_log(db, "create_sku", sku.sku_code, original_input,
                       "", "", "SKU已存在", 400)
    db_sku = models.SKU(**sku.dict())
    db.add(db_sku)
    db.commit()
    db.refresh(db_sku)
    log_operation(db, "create_sku", sku.sku_code, original_input,
                  "", "", "SKU创建成功", "success")
    return db_sku


@app.get("/skus/", response_model=List[schemas.SKUResponse])
def list_skus(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    skus = db.query(models.SKU).offset(skip).limit(limit).all()
    return skus


@app.post("/inventory/snapshots/", response_model=schemas.InventorySnapshotResponse)
def create_inventory_snapshot(snapshot: schemas.InventorySnapshotCreate, db: Session = Depends(get_db)):
    original_input = snapshot.dict()
    try:
        cabinet = db.query(models.Cabinet).filter(models.Cabinet.cabinet_no == snapshot.cabinet_no).first()
        if not cabinet:
            raise_with_log(db, "create_inventory_snapshot", f"{snapshot.cabinet_no}-{snapshot.sku_code}",
                           original_input, snapshot.created_by or "", "", "货柜不存在", 404)

        sku = db.query(models.SKU).filter(models.SKU.sku_code == snapshot.sku_code).first()
        if not sku:
            raise_with_log(db, "create_inventory_snapshot", f"{snapshot.cabinet_no}-{snapshot.sku_code}",
                           original_input, snapshot.created_by or "", "", "SKU不存在", 404)

        db_snapshot = models.InventorySnapshot(
            cabinet_id=cabinet.id,
            sku_id=sku.id,
            quantity=snapshot.quantity,
            batch_no=snapshot.batch_no,
            expiry_date=snapshot.expiry_date,
            created_by=snapshot.created_by
        )
        db.add(db_snapshot)
        db.commit()
        db.refresh(db_snapshot)

        log_operation(db, "create_inventory_snapshot", f"{snapshot.cabinet_no}-{snapshot.sku_code}",
                       original_input, snapshot.created_by or "", "", "库存快照创建成功",
                       "success")

        response = schemas.InventorySnapshotResponse(
            id=db_snapshot.id,
            cabinet_no=snapshot.cabinet_no,
            sku_code=snapshot.sku_code,
            sku_name=sku.name,
            quantity=db_snapshot.quantity,
            batch_no=db_snapshot.batch_no,
            expiry_date=db_snapshot.expiry_date,
            snapshot_time=db_snapshot.snapshot_time
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "create_inventory_snapshot", f"{snapshot.cabinet_no}-{snapshot.sku_code}",
                       original_input, snapshot.created_by or "", "", str(e), "failed", str(e))
        raise


@app.get("/inventory/snapshots/", response_model=List[schemas.InventorySnapshotResponse])
def list_inventory_snapshots(
    cabinet_no: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.InventorySnapshot, models.Cabinet, models.SKU).join(
        models.Cabinet, models.InventorySnapshot.cabinet_id == models.Cabinet.id
    ).join(
        models.SKU, models.InventorySnapshot.sku_id == models.SKU.id
    )

    if cabinet_no:
        query = query.filter(models.Cabinet.cabinet_no == cabinet_no)

    results = query.offset(skip).limit(limit).all()

    responses = []
    for snapshot, cabinet, sku in results:
        responses.append(schemas.InventorySnapshotResponse(
            id=snapshot.id,
            cabinet_no=cabinet.cabinet_no,
            sku_code=sku.sku_code,
            sku_name=sku.name,
            quantity=snapshot.quantity,
            batch_no=snapshot.batch_no,
            expiry_date=snapshot.expiry_date,
            snapshot_time=snapshot.snapshot_time
        ))
    return responses


@app.post("/replenishments/", response_model=schemas.ReplenishmentResponse)
def create_replenishment(replenishment: schemas.ReplenishmentCreate, db: Session = Depends(get_db)):
    original_input = replenishment.dict()
    try:
        existing = db.query(models.Replenishment).filter(
            models.Replenishment.replenishment_no == replenishment.replenishment_no
        ).first()
        if existing:
            raise_with_log(db, "create_replenishment", replenishment.replenishment_no,
                           original_input, replenishment.operator_id or "", replenishment.operator_name or "",
                           "补货单号已存在，幂等校验通过", 400)

        cabinet = db.query(models.Cabinet).filter(
            models.Cabinet.cabinet_no == replenishment.cabinet_no
        ).first()
        if not cabinet:
            raise_with_log(db, "create_replenishment", replenishment.replenishment_no,
                           original_input, replenishment.operator_id or "", replenishment.operator_name or "",
                           "货柜不存在", 404)

        db_replenishment = models.Replenishment(
            cabinet_id=cabinet.id,
            replenishment_no=replenishment.replenishment_no,
            remark=replenishment.remark,
            operator_id=replenishment.operator_id,
            operator_name=replenishment.operator_name
        )
        db.add(db_replenishment)
        db.flush()

        for item in replenishment.items:
            sku = db.query(models.SKU).filter(models.SKU.sku_code == item.sku_code).first()
            if not sku:
                raise_with_log(db, "create_replenishment", replenishment.replenishment_no,
                               original_input, replenishment.operator_id or "", replenishment.operator_name or "",
                               f"SKU {item.sku_code} 不存在", 404)
            db_item = models.ReplenishmentItem(
                replenishment_id=db_replenishment.id,
                sku_id=sku.id,
                quantity=item.quantity,
                batch_no=item.batch_no,
                expiry_date=item.expiry_date
            )
            db.add(db_item)

        db.commit()
        db.refresh(db_replenishment)

        log_operation(db, "create_replenishment", replenishment.replenishment_no,
                       original_input, replenishment.operator_id or "", replenishment.operator_name or "",
                       "补货单创建成功", "success")

        return get_replenishment_response(db_replenishment, db)
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "create_replenishment", replenishment.replenishment_no,
                       original_input, replenishment.operator_id or "", replenishment.operator_name or "",
                       str(e), "failed", str(e))
        raise


@app.post("/replenishments/{replenishment_no}/confirm", response_model=schemas.ReplenishmentResponse)
def confirm_replenishment(
    replenishment_no: str,
    confirm: schemas.ReplenishmentConfirm,
    db: Session = Depends(get_db)
):
    original_input = confirm.dict()
    try:
        replenishment = db.query(models.Replenishment).filter(
            models.Replenishment.replenishment_no == replenishment_no
        ).first()
        if not replenishment:
            raise_with_log(db, "confirm_replenishment", replenishment_no,
                           original_input, confirm.operator_id, confirm.operator_name,
                           "补货单不存在", 404)

        if replenishment.status != "pending":
            raise_with_log(db, "confirm_replenishment", replenishment_no,
                           original_input, confirm.operator_id, confirm.operator_name,
                           "补货单状态不允许确认", 400)

        replenishment.status = "confirmed"
        replenishment.operator_id = confirm.operator_id
        replenishment.operator_name = confirm.operator_name
        replenishment.confirmed_at = datetime.utcnow()

        if confirm.items:
            for item_data in confirm.items:
                db_item = db.query(models.ReplenishmentItem).filter(
                    models.ReplenishmentItem.id == item_data["id"]
                ).first()
                if db_item:
                    db_item.actual_quantity = item_data.get("actual_quantity", db_item.quantity)

        db.commit()
        db.refresh(replenishment)

        log_operation(db, "confirm_replenishment", replenishment_no,
                       original_input, confirm.operator_id, confirm.operator_name,
                       "补货单确认成功", "success")

        return get_replenishment_response(replenishment, db)
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "confirm_replenishment", replenishment_no,
                       original_input, confirm.operator_id, confirm.operator_name,
                       str(e), "failed", str(e))
        raise


def get_replenishment_response(replenishment, db):
    items = db.query(models.ReplenishmentItem, models.SKU).join(
        models.SKU, models.ReplenishmentItem.sku_id == models.SKU.id
    ).filter(models.ReplenishmentItem.replenishment_id == replenishment.id).all()

    item_responses = []
    for item, sku in items:
        item_responses.append(schemas.ReplenishmentItemResponse(
            id=item.id,
        sku_code=sku.sku_code,
        sku_name=sku.name,
        quantity=item.quantity,
        actual_quantity=item.actual_quantity,
        batch_no=item.batch_no,
        expiry_date=item.expiry_date
    ))

    cabinet = db.query(models.Cabinet).filter(models.Cabinet.id == replenishment.cabinet_id).first()

    return schemas.ReplenishmentResponse(
        id=replenishment.id,
        cabinet_no=cabinet.cabinet_no,
        replenishment_no=replenishment.replenishment_no,
        status=replenishment.status,
        operator_id=replenishment.operator_id,
        operator_name=replenishment.operator_name,
        confirmed_at=replenishment.confirmed_at,
        remark=replenishment.remark,
        items=item_responses,
        created_at=replenishment.created_at
    )


@app.get("/replenishments/", response_model=List[schemas.ReplenishmentResponse])
def list_replenishments(
    cabinet_no: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Replenishment)
    if status:
        query = query.filter(models.Replenishment.status == status)
    replenishments = query.offset(skip).limit(limit).all()
    return [get_replenishment_response(r, db) for r in replenishments]


@app.post("/damages/", response_model=schemas.DamageRecordResponse)
def create_damage_record(damage: schemas.DamageRecordCreate, db: Session = Depends(get_db)):
    original_input = damage.dict()
    try:
        cabinet = db.query(models.Cabinet).filter(models.Cabinet.cabinet_no == damage.cabinet_no).first()
        if not cabinet:
            raise_with_log(db, "create_damage_record", "",
                           original_input, damage.reporter_id or "", damage.reporter_name or "",
                           "货柜不存在", 404)

        sku = db.query(models.SKU).filter(models.SKU.sku_code == damage.sku_code).first()
        if not sku:
            raise_with_log(db, "create_damage_record", "",
                           original_input, damage.reporter_id or "", damage.reporter_name or "",
                           "SKU不存在", 404)

        import time
        damage_no = f"DM{int(time.time() * 1000000)}"
        db_damage = models.DamageRecord(
            cabinet_id=cabinet.id,
            damage_no=damage_no,
            sku_id=sku.id,
            quantity=damage.quantity,
            damage_type=damage.damage_type,
            reason=damage.reason,
            reporter_id=damage.reporter_id,
            reporter_name=damage.reporter_name
        )
        db.add(db_damage)
        db.commit()
        db.refresh(db_damage)

        log_operation(db, "create_damage_record", damage_no,
                       original_input, damage.reporter_id or "", damage.reporter_name or "",
                       "货损记录创建成功", "success")

        return schemas.DamageRecordResponse(
            id=db_damage.id,
            damage_no=damage_no,
            cabinet_no=damage.cabinet_no,
            sku_code=damage.sku_code,
            sku_name=sku.name,
            quantity=db_damage.quantity,
            damage_type=db_damage.damage_type,
            reason=db_damage.reason,
            reporter_id=db_damage.reporter_id,
            reporter_name=db_damage.reporter_name,
            status=db_damage.status,
            created_at=db_damage.created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "create_damage_record", "",
                       original_input, damage.reporter_id or "", damage.reporter_name or "",
                       str(e), "failed", str(e))
        raise


@app.post("/damages/{damage_no}/confirm", response_model=schemas.DamageRecordResponse)
def confirm_damage_record(
    damage_no: str,
    confirm: schemas.DamageRecordConfirm,
    db: Session = Depends(get_db)
):
    original_input = confirm.dict()
    try:
        damage = db.query(models.DamageRecord).filter(
            models.DamageRecord.damage_no == damage_no
        ).first()
        if not damage:
            raise_with_log(db, "confirm_damage_record", damage_no,
                           original_input, confirm.confirmer_id, confirm.confirmer_name,
                           "货损记录不存在", 404)

        if damage.status != "pending":
            raise_with_log(db, "confirm_damage_record", damage_no,
                           original_input, confirm.confirmer_id, confirm.confirmer_name,
                           "货损记录已处理", 400)

        damage.status = "confirmed"
        damage.confirmer_id = confirm.confirmer_id
        damage.confirmer_name = confirm.confirmer_name
        damage.confirmed_at = datetime.utcnow()

        db.commit()
        db.refresh(damage)

        log_operation(db, "confirm_damage_record", damage_no,
                       original_input, confirm.confirmer_id, confirm.confirmer_name,
                       "货损记录确认成功", "success")

        cabinet = db.query(models.Cabinet).filter(models.Cabinet.id == damage.cabinet_id).first()
        sku = db.query(models.SKU).filter(models.SKU.id == damage.sku_id).first()

        return schemas.DamageRecordResponse(
            id=damage.id,
            damage_no=damage_no,
            cabinet_no=cabinet.cabinet_no,
            sku_code=sku.sku_code,
            sku_name=sku.name,
            quantity=damage.quantity,
            damage_type=damage.damage_type,
            reason=damage.reason,
            reporter_id=damage.reporter_id,
            reporter_name=damage.reporter_name,
            status=damage.status,
            created_at=damage.created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "confirm_damage_record", damage_no,
                       original_input, confirm.confirmer_id, confirm.confirmer_name,
                       str(e), "failed", str(e))
        raise


@app.get("/damages/", response_model=List[schemas.DamageRecordResponse])
def list_damage_records(
    cabinet_no: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.DamageRecord, models.Cabinet, models.SKU).join(
        models.Cabinet, models.DamageRecord.cabinet_id == models.Cabinet.id
    ).join(
        models.SKU, models.DamageRecord.sku_id == models.SKU.id
    )

    if cabinet_no:
        query = query.filter(models.Cabinet.cabinet_no == cabinet_no)
    if status:
        query = query.filter(models.DamageRecord.status == status)

    results = query.offset(skip).limit(limit).all()

    responses = []
    for damage, cabinet, sku in results:
        responses.append(schemas.DamageRecordResponse(
            id=damage.id,
            damage_no=damage.damage_no,
            cabinet_no=cabinet.cabinet_no,
            sku_code=sku.sku_code,
            sku_name=sku.name,
            quantity=damage.quantity,
            damage_type=damage.damage_type,
            reason=damage.reason,
            reporter_id=damage.reporter_id,
            reporter_name=damage.reporter_name,
            status=damage.status,
            created_at=damage.created_at
        ))
    return responses


@app.post("/expired-products/", response_model=schemas.ExpiredProductResponse)
def create_expired_product(expired: schemas.ExpiredProductCreate, db: Session = Depends(get_db)):
    original_input = expired.dict()
    try:
        cabinet = db.query(models.Cabinet).filter(models.Cabinet.cabinet_no == expired.cabinet_no).first()
        if not cabinet:
            raise_with_log(db, "create_expired_product", "",
                           original_input, expired.operator_id or "", expired.operator_name or "",
                           "货柜不存在", 404)

        sku = db.query(models.SKU).filter(models.SKU.sku_code == expired.sku_code).first()
        if not sku:
            raise_with_log(db, "create_expired_product", "",
                           original_input, expired.operator_id or "", expired.operator_name or "",
                           "SKU不存在", 404)

        import time
        record_no = f"EX{int(time.time() * 1000000)}"
        db_expired = models.ExpiredProduct(
            cabinet_id=cabinet.id,
            record_no=record_no,
            sku_id=sku.id,
            quantity=expired.quantity,
            batch_no=expired.batch_no,
            expiry_date=expired.expiry_date,
            operator_id=expired.operator_id,
            operator_name=expired.operator_name
        )
        db.add(db_expired)
        db.commit()
        db.refresh(db_expired)

        log_operation(db, "create_expired_product", record_no,
                       original_input, expired.operator_id or "", expired.operator_name or "",
                       "临期下架记录创建成功", "success")

        return schemas.ExpiredProductResponse(
            id=db_expired.id,
            record_no=record_no,
            cabinet_no=expired.cabinet_no,
            sku_code=expired.sku_code,
            sku_name=sku.name,
            quantity=db_expired.quantity,
            batch_no=db_expired.batch_no,
            expiry_date=db_expired.expiry_date,
            operator_id=db_expired.operator_id,
            operator_name=db_expired.operator_name,
            status=db_expired.status,
            created_at=db_expired.created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "create_expired_product", "",
                       original_input, expired.operator_id or "", expired.operator_name or "",
                       str(e), "failed", str(e))
        raise


@app.post("/expired-products/{record_no}/confirm")
def confirm_expired_product(record_no: str, db: Session = Depends(get_db)):
    try:
        expired = db.query(models.ExpiredProduct).filter(
            models.ExpiredProduct.record_no == record_no
        ).first()
        if not expired:
            raise_with_log(db, "confirm_expired_product", record_no,
                           {}, "", "", "临期下架记录不存在", 404)

        if expired.status != "pending":
            raise_with_log(db, "confirm_expired_product", record_no,
                           {}, "", "", "记录已处理", 400)

        expired.status = "confirmed"
        expired.confirmed_at = datetime.utcnow()

        db.commit()

        log_operation(db, "confirm_expired_product", record_no,
                       {}, "", "", "临期下架确认成功", "success")

        return {"message": "确认成功", "record_no": record_no}
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "confirm_expired_product", record_no,
                       {}, "", "", str(e), "failed", str(e))
        raise


@app.get("/expired-products/", response_model=List[schemas.ExpiredProductResponse])
def list_expired_products(
    cabinet_no: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.ExpiredProduct, models.Cabinet, models.SKU).join(
        models.Cabinet, models.ExpiredProduct.cabinet_id == models.Cabinet.id
    ).join(
        models.SKU, models.ExpiredProduct.sku_id == models.SKU.id
    )

    if cabinet_no:
        query = query.filter(models.Cabinet.cabinet_no == cabinet_no)
    if status:
        query = query.filter(models.ExpiredProduct.status == status)

    results = query.offset(skip).limit(limit).all()

    responses = []
    for expired, cabinet, sku in results:
        responses.append(schemas.ExpiredProductResponse(
            id=expired.id,
            record_no=expired.record_no,
            cabinet_no=cabinet.cabinet_no,
            sku_code=sku.sku_code,
            sku_name=sku.name,
            quantity=expired.quantity,
            batch_no=expired.batch_no,
            expiry_date=expired.expiry_date,
            operator_id=expired.operator_id,
            operator_name=expired.operator_name,
            status=expired.status,
            created_at=expired.created_at
        ))
    return responses


@app.post("/settlements/", response_model=schemas.SettlementResponse)
def create_settlement(settlement: schemas.SettlementCreate, db: Session = Depends(get_db)):
    original_input = settlement.dict()
    try:
        existing = db.query(models.Settlement).filter(
            models.Settlement.settlement_no == settlement.settlement_no
        ).first()
        if existing:
            raise_with_log(db, "create_settlement", settlement.settlement_no,
                           original_input, settlement.created_by or "", "",
                           "结算单号已存在", 400)

        cabinet = db.query(models.Cabinet).filter(
            models.Cabinet.cabinet_no == settlement.cabinet_no
        ).first()
        if not cabinet:
            raise_with_log(db, "create_settlement", settlement.settlement_no,
                           original_input, settlement.created_by or "", "",
                           "货柜不存在", 404)

        db_settlement = models.Settlement(
            cabinet_id=cabinet.id,
            settlement_no=settlement.settlement_no,
            period_start=settlement.period_start,
            period_end=settlement.period_end,
            status="draft",
            created_by=settlement.created_by
        )
        db.add(db_settlement)
        db.flush()

        skus = db.query(models.SKU).all()
        for sku in skus:
            detail = models.SettlementDetail(
                settlement_id=db_settlement.id,
                sku_id=sku.id
            )
            db.add(detail)

        db.commit()
        db.refresh(db_settlement)

        log_operation(db, "create_settlement", settlement.settlement_no,
                       original_input, settlement.created_by or "", "",
                       "结算单创建成功", "success")

        return calculate_settlement_details(db_settlement, db)
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "create_settlement", settlement.settlement_no,
                       original_input, settlement.created_by or "", "",
                       str(e), "failed", str(e))
        raise


def calculate_settlement_details(settlement, db):
    from sqlalchemy import func

    cabinet = db.query(models.Cabinet).filter(models.Cabinet.id == settlement.cabinet_id).first()

    details = db.query(models.SettlementDetail, models.SKU).join(
        models.SKU, models.SettlementDetail.sku_id == models.SKU.id
    ).filter(models.SettlementDetail.settlement_id == settlement.id).all()

    # 周期内已确认的补货单
    replenishments = db.query(models.Replenishment).filter(
        models.Replenishment.cabinet_id == settlement.cabinet_id,
        models.Replenishment.status == "confirmed",
        models.Replenishment.created_at >= settlement.period_start,
        models.Replenishment.created_at <= settlement.period_end
    ).all()

    # 周期内已确认的货损记录
    damages = db.query(models.DamageRecord).filter(
        models.DamageRecord.cabinet_id == settlement.cabinet_id,
        models.DamageRecord.status == "confirmed",
        models.DamageRecord.created_at >= settlement.period_start,
        models.DamageRecord.created_at <= settlement.period_end
    ).all()

    # 周期内已确认的临期下架记录
    expired = db.query(models.ExpiredProduct).filter(
        models.ExpiredProduct.cabinet_id == settlement.cabinet_id,
        models.ExpiredProduct.status == "confirmed",
        models.ExpiredProduct.created_at >= settlement.period_start,
        models.ExpiredProduct.created_at <= settlement.period_end
    ).all()

    # 期初库存快照（取周期开始前的最新快照，按SKU分组取最新）
    opening_snapshot_subq = db.query(
        models.InventorySnapshot.sku_id,
        func.max(models.InventorySnapshot.snapshot_time).label("max_time")
    ).filter(
        models.InventorySnapshot.cabinet_id == settlement.cabinet_id,
        models.InventorySnapshot.snapshot_time < settlement.period_start
    ).group_by(models.InventorySnapshot.sku_id).subquery()

    opening_inventory_map = {}
    for sku_id, quantity in db.query(
        models.InventorySnapshot.sku_id,
        models.InventorySnapshot.quantity
    ).join(
        opening_snapshot_subq,
        (models.InventorySnapshot.sku_id == opening_snapshot_subq.c.sku_id) &
        (models.InventorySnapshot.snapshot_time == opening_snapshot_subq.c.max_time)
    ).filter(models.InventorySnapshot.cabinet_id == settlement.cabinet_id).all():
        opening_inventory_map[sku_id] = quantity

    # 期末库存快照（取周期结束前的最新快照）
    closing_snapshot_subq = db.query(
        models.InventorySnapshot.sku_id,
        func.max(models.InventorySnapshot.snapshot_time).label("max_time")
    ).filter(
        models.InventorySnapshot.cabinet_id == settlement.cabinet_id,
        models.InventorySnapshot.snapshot_time <= settlement.period_end
    ).group_by(models.InventorySnapshot.sku_id).subquery()

    closing_inventory_map = {}
    for sku_id, quantity in db.query(
        models.InventorySnapshot.sku_id,
        models.InventorySnapshot.quantity
    ).join(
        closing_snapshot_subq,
        (models.InventorySnapshot.sku_id == closing_snapshot_subq.c.sku_id) &
        (models.InventorySnapshot.snapshot_time == closing_snapshot_subq.c.max_time)
    ).filter(models.InventorySnapshot.cabinet_id == settlement.cabinet_id).all():
        closing_inventory_map[sku_id] = quantity

    detail_responses = []
    total_sales = 0
    total_damage_loss = 0
    total_expired_loss = 0
    total_replenishment = 0

    for detail, sku in details:
        # 期初库存（从期初快照映射中获取，默认0）
        opening_qty = opening_inventory_map.get(sku.id, 0)
        detail.opening_inventory = opening_qty

        # 期末库存（从期末快照映射中获取，默认0）
        closing_qty = closing_inventory_map.get(sku.id, 0)
        detail.closing_inventory = closing_qty

        # 周期内补货数量
        replenishment_qty = sum(
            item.quantity for r in replenishments
            for item in r.items if item.sku_id == sku.id
        )
        detail.replenishment_quantity = replenishment_qty

        # 周期内货损数量
        damage_qty = sum(d.quantity for d in damages if d.sku_id == sku.id)
        detail.damage_quantity = damage_qty

        # 周期内临期下架数量
        expired_qty = sum(e.quantity for e in expired if e.sku_id == sku.id)
        detail.expired_quantity = expired_qty

        # 核心公式：期初 + 补货 - 销售 - 货损 - 临期 = 期末
        # 推导出：销售 = 期初 + 补货 - 货损 - 临期 - 期末
        # 保证销售数量不小于0
        sales_qty = max(0, opening_qty + replenishment_qty - damage_qty - expired_qty - closing_qty)
        detail.sales_quantity = sales_qty

        # 计算各项金额
        detail.sales_amount = sales_qty * sku.price
        detail.damage_loss = damage_qty * sku.price
        detail.expired_loss = expired_qty * sku.price

        # 累加总计
        total_sales += detail.sales_amount
        total_damage_loss += detail.damage_loss
        total_expired_loss += detail.expired_loss
        total_replenishment += replenishment_qty

        detail_responses.append(schemas.SettlementDetailResponse(
            id=detail.id,
            sku_code=sku.sku_code,
            sku_name=sku.name,
            opening_inventory=detail.opening_inventory,
            replenishment_quantity=detail.replenishment_quantity,
            sales_quantity=detail.sales_quantity,
            damage_quantity=detail.damage_quantity,
            expired_quantity=detail.expired_quantity,
            closing_inventory=detail.closing_inventory,
            sales_amount=detail.sales_amount,
            damage_loss=detail.damage_loss,
            expired_loss=detail.expired_loss
        ))

    settlement.total_sales = total_sales
    settlement.total_damage_loss = total_damage_loss
    settlement.total_expired_loss = total_expired_loss
    settlement.total_replenishment = total_replenishment
    settlement.net_amount = total_sales - total_damage_loss - total_expired_loss
    db.commit()

    return schemas.SettlementResponse(
        id=settlement.id,
        cabinet_no=cabinet.cabinet_no,
        settlement_no=settlement.settlement_no,
        period_start=settlement.period_start,
        period_end=settlement.period_end,
        status=settlement.status,
        total_sales=settlement.total_sales,
        total_damage_loss=settlement.total_damage_loss,
        total_expired_loss=settlement.total_expired_loss,
        total_replenishment=settlement.total_replenishment,
        net_amount=settlement.net_amount,
        details=detail_responses,
        created_at=settlement.created_at
    )


@app.post("/settlements/{settlement_no}/confirm", response_model=schemas.SettlementResponse)
def confirm_settlement(
    settlement_no: str,
    confirm: schemas.SettlementConfirm,
    db: Session = Depends(get_db)
):
    original_input = confirm.dict()
    try:
        settlement = db.query(models.Settlement).filter(
            models.Settlement.settlement_no == settlement_no
        ).first()
        if not settlement:
            raise_with_log(db, "confirm_settlement", settlement_no,
                           original_input, confirm.confirmed_by, "",
                           "结算单不存在", 404)

        if settlement.status != "draft":
            raise_with_log(db, "confirm_settlement", settlement_no,
                           original_input, confirm.confirmed_by, "",
                           "结算单状态不允许确认", 400)

        settlement.status = "confirmed"
        settlement.confirmed_by = confirm.confirmed_by
        settlement.confirmed_at = datetime.utcnow()
        db.commit()
        db.refresh(settlement)

        log_operation(db, "confirm_settlement", settlement_no,
                       original_input, confirm.confirmed_by, "",
                       "结算单确认成功", "success")

        return calculate_settlement_details(settlement, db)
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "confirm_settlement", settlement_no,
                       original_input, confirm.confirmed_by, "",
                       str(e), "failed", str(e))
        raise


@app.post("/settlements/{settlement_no}/close")
def close_settlement(
    settlement_no: str,
    close_data: schemas.CloseSettlementQuery,
    db: Session = Depends(get_db)
):
    original_input = close_data.dict()
    try:
        settlement = db.query(models.Settlement).filter(
            models.Settlement.settlement_no == settlement_no
        ).first()
        if not settlement:
            raise_with_log(db, "close_settlement", settlement_no,
                           original_input, close_data.operator_id, close_data.operator_name,
                           "结算单不存在", 404)

        settlement.status = "closed"
        db.commit()

        log_operation(db, "close_settlement", settlement_no,
                       original_input, close_data.operator_id, close_data.operator_name,
                       f"结算单关闭成功，原因：{close_data.reason}", "success")

        return {"message": "结算单已关闭", "settlement_no": settlement_no}
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "close_settlement", settlement_no,
                       original_input, close_data.operator_id, close_data.operator_name,
                       str(e), "failed", str(e))
        raise


@app.get("/settlements/", response_model=List[schemas.SettlementResponse])
def list_settlements(
    cabinet_no: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Settlement)
    if status:
        query = query.filter(models.Settlement.status == status)
    settlements = query.offset(skip).limit(limit).all()
    return [calculate_settlement_details(s, db) for s in settlements]


@app.post("/corrections/")
def create_correction(correction: schemas.CorrectionCreate, db: Session = Depends(get_db)):
    original_input = correction.dict()
    try:
        cabinet = db.query(models.Cabinet).filter(models.Cabinet.cabinet_no == correction.cabinet_no).first()
        if not cabinet:
            raise_with_log(db, "manual_correction", correction.cabinet_no,
                           original_input, correction.operator_id, correction.operator_name,
                           "货柜不存在", 404)

        sku = db.query(models.SKU).filter(models.SKU.sku_code == correction.sku_code).first()
        if not sku:
            raise_with_log(db, "manual_correction", correction.cabinet_no,
                           original_input, correction.operator_id, correction.operator_name,
                           "SKU不存在", 404)

        snapshot = models.InventorySnapshot(
            cabinet_id=cabinet.id,
            sku_id=sku.id,
            quantity=correction.quantity,
            created_by=correction.operator_id
        )
        db.add(snapshot)
        db.commit()

        log_operation(db, "manual_correction", correction.cabinet_no,
                       original_input, correction.operator_id, correction.operator_name,
                       f"人工修正成功，原因：{correction.reason}", "success")

        return {"message": "人工修正成功", "cabinet_no": correction.cabinet_no}
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "manual_correction", correction.cabinet_no,
                       original_input, correction.operator_id, correction.operator_name,
                       str(e), "failed", str(e))
        raise


@app.get("/operation-logs/", response_model=List[schemas.OperationLogResponse])
def list_operation_logs(
    operation_type: Optional[str] = None,
    ref_no: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.OperationLog)
    if operation_type:
        query = query.filter(models.OperationLog.operation_type == operation_type)
    if ref_no:
        query = query.filter(models.OperationLog.ref_no == ref_no)
    if status:
        query = query.filter(models.OperationLog.status == status)
    logs = query.order_by(models.OperationLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs


@app.get("/settlements/{settlement_no}/export")
def export_settlement(settlement_no: str, format: str = "csv", db: Session = Depends(get_db)):
    try:
        settlement = db.query(models.Settlement).filter(
            models.Settlement.settlement_no == settlement_no
        ).first()
        if not settlement:
            raise_with_log(db, "export_settlement", settlement_no,
                           {"settlement_no": settlement_no, "format": format}, "", "",
                           "结算单不存在", 404)
    except HTTPException:
        raise
    except Exception as e:
        log_operation(db, "export_settlement", settlement_no,
                       {"settlement_no": settlement_no, "format": format}, "", "",
                       str(e), "failed", str(e))
        raise

    cabinet = db.query(models.Cabinet).filter(models.Cabinet.id == settlement.cabinet_id).first()
    details = db.query(models.SettlementDetail, models.SKU).join(
        models.SKU, models.SettlementDetail.sku_id == models.SKU.id
    ).filter(models.SettlementDetail.settlement_id == settlement.id).all()

    if format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["货柜", cabinet.cabinet_no])
        writer.writerow(["结算单号", settlement.settlement_no])
        writer.writerow(["结算周期", f"{settlement.period_start} 至 {settlement.period_end}"])
        writer.writerow([])
        writer.writerow(["SKU编码", "SKU名称", "期初库存", "补货数量", "销售数量", "货损数量", "临期下架", "期末库存", "销售额", "货损金额", "临期损失"])
        for detail, sku in details:
            writer.writerow([
                sku.sku_code, sku.name,
                detail.opening_inventory, detail.replenishment_quantity,
                detail.sales_quantity, detail.damage_quantity,
                detail.expired_quantity, detail.closing_inventory,
                detail.sales_amount, detail.damage_loss, detail.expired_loss
            ])
        writer.writerow([])
        writer.writerow(["总销售额", "", "", "", "", "", "", "", settlement.total_sales, settlement.total_damage_loss, settlement.total_expired_loss])
        writer.writerow(["净结算金额", settlement.net_amount])
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=settlement_{settlement_no}.csv"}
        )
    
    return {"message": "不支持的导出格式"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
