from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import models, schemas
from datetime import datetime
from typing import Optional, List


def get_material_by_code(db: Session, material_code: str):
    return db.query(models.Material).filter(models.Material.material_code == material_code).first()


def create_material(db: Session, material: schemas.MaterialCreate):
    db_material = models.Material(**material.model_dump())
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


def get_booth_by_code(db: Session, booth_code: str):
    return db.query(models.Booth).filter(models.Booth.booth_code == booth_code).first()


def create_booth(db: Session, booth: schemas.BoothCreate):
    db_booth = models.Booth(**booth.model_dump())
    db.add(db_booth)
    db.commit()
    db.refresh(db_booth)
    return db_booth


def get_transfer_order_by_no(db: Session, order_no: str):
    return db.query(models.TransferOrder).filter(models.TransferOrder.order_no == order_no).first()


def create_transfer_order(db: Session, transfer: schemas.TransferOrderCreate):
    material = get_material_by_code(db, transfer.material_code)
    if not material:
        raise ValueError(f"物料编码 {transfer.material_code} 不存在")
    
    booth = get_booth_by_code(db, transfer.booth_code)
    if not booth:
        raise ValueError(f"展位编码 {transfer.booth_code} 不存在")
    
    if material.available_quantity < transfer.quantity:
        raise ValueError(f"物料 {material.name} 库存不足，可用数量: {material.available_quantity}")
    
    material.available_quantity -= transfer.quantity
    
    transfer_data = transfer.model_dump(exclude={'material_code', 'booth_code'})
    db_transfer = models.TransferOrder(
        **transfer_data,
        material_id=material.id,
        booth_id=booth.id,
        status=models.TransferStatus.PENDING
    )
    db.add(db_transfer)
    db.commit()
    db.refresh(db_transfer)
    return db_transfer


def create_return_record(db: Session, return_record: schemas.ReturnRecordCreate):
    transfer = get_transfer_order_by_no(db, return_record.order_no)
    if not transfer:
        raise ValueError(f"调拨单号 {return_record.order_no} 不存在")
    
    if transfer.returned_quantity + return_record.quantity > transfer.quantity:
        raise ValueError(f"归还数量超过调拨数量，已归还: {transfer.returned_quantity}, 调拨: {transfer.quantity}")
    
    transfer.returned_quantity += return_record.quantity
    transfer.material.available_quantity += return_record.quantity
    
    if transfer.returned_quantity == transfer.quantity:
        transfer.status = models.TransferStatus.RETURNED
        transfer.exception_type = models.ExceptionType.NONE
    else:
        transfer.status = models.TransferStatus.PARTIAL_RETURNED
    
    if return_record.exception_type != models.ExceptionType.NONE:
        transfer.exception_type = return_record.exception_type
        transfer.exception_note = return_record.exception_note
        transfer.status = models.TransferStatus.ABNORMAL
    
    return_data = return_record.model_dump(exclude={'order_no'})
    db_return = models.ReturnRecord(
        **return_data,
        transfer_order_id=transfer.id
    )
    db.add(db_return)
    db.commit()
    db.refresh(db_return)
    return db_return


def create_import_error_log(db: Session, error_log: schemas.ImportErrorLogCreate):
    db_error = models.ImportErrorLog(**error_log.model_dump())
    db.add(db_error)
    db.commit()
    db.refresh(db_error)
    return db_error


def query_transfer_orders(
    db: Session,
    query: schemas.TransferQuery,
    page: int = 1,
    page_size: int = 50
):
    db_query = db.query(models.TransferOrder).join(models.Booth).join(models.Material)
    
    conditions = []
    if query.borrower:
        conditions.append(models.TransferOrder.borrower.contains(query.borrower))
    if query.manager:
        conditions.append(models.Booth.manager.contains(query.manager))
    if query.start_time:
        conditions.append(models.TransferOrder.transfer_time >= query.start_time)
    if query.end_time:
        conditions.append(models.TransferOrder.transfer_time <= query.end_time)
    if query.status:
        conditions.append(models.TransferOrder.status == query.status)
    if query.exception_type:
        conditions.append(models.TransferOrder.exception_type == query.exception_type)
    if query.booth_code:
        conditions.append(models.Booth.booth_code == query.booth_code)
    
    if conditions:
        db_query = db_query.filter(and_(*conditions))
    
    total = db_query.count()
    items = db_query.order_by(models.TransferOrder.transfer_time.desc())\
        .offset((page - 1) * page_size).limit(page_size).all()
    
    return total, items


def get_transfer_summary(db: Session, query: schemas.TransferQuery):
    db_query = db.query(models.TransferOrder).join(models.Booth).join(models.Material)
    
    conditions = []
    if query.borrower:
        conditions.append(models.TransferOrder.borrower.contains(query.borrower))
    if query.manager:
        conditions.append(models.Booth.manager.contains(query.manager))
    if query.start_time:
        conditions.append(models.TransferOrder.transfer_time >= query.start_time)
    if query.end_time:
        conditions.append(models.TransferOrder.transfer_time <= query.end_time)
    if query.status:
        conditions.append(models.TransferOrder.status == query.status)
    if query.exception_type:
        conditions.append(models.TransferOrder.exception_type == query.exception_type)
    if query.booth_code:
        conditions.append(models.Booth.booth_code == query.booth_code)
    
    if conditions:
        db_query = db_query.filter(and_(*conditions))
    
    total_transfers = db_query.count()
    total_quantity = sum(t.quantity for t in db_query.all())
    
    status_summary = {}
    for status in models.TransferStatus:
        count = db_query.filter(models.TransferOrder.status == status).count()
        if count > 0:
            status_summary[status.value] = count
    
    exception_summary = []
    for exc_type in models.ExceptionType:
        if exc_type == models.ExceptionType.NONE:
            continue
        exc_query = db_query.filter(models.TransferOrder.exception_type == exc_type)
        count = exc_query.count()
        if count > 0:
            affected_qty = sum(t.quantity for t in exc_query.all())
            exception_summary.append({
                "exception_type": exc_type.value,
                "count": count,
                "affected_quantity": affected_qty
            })
    
    return {
        "total_transfers": total_transfers,
        "total_quantity": total_quantity,
        "status_summary": status_summary,
        "exception_summary": exception_summary
    }


def get_all_materials(db: Session):
    return db.query(models.Material).all()


def get_all_booths(db: Session):
    return db.query(models.Booth).all()


def get_import_errors(db: Session, import_type: Optional[str] = None, resolved: Optional[int] = None):
    query = db.query(models.ImportErrorLog)
    if import_type:
        query = query.filter(models.ImportErrorLog.import_type == import_type)
    if resolved is not None:
        query = query.filter(models.ImportErrorLog.resolved == resolved)
    return query.order_by(models.ImportErrorLog.created_at.desc()).all()
