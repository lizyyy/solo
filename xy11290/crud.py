from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any
import models, schemas
from datetime import datetime
import uuid


def generate_code(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:8].upper()}"


def create_material(db: Session, material: schemas.MaterialCreate):
    db_material = models.Material(**material.dict())
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


def get_material(db: Session, material_id: int):
    return db.query(models.Material).filter(models.Material.id == material_id).first()


def get_material_by_code(db: Session, material_code: str):
    return db.query(models.Material).filter(models.Material.material_code == material_code).first()


def get_materials(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Material).offset(skip).limit(limit).all()


def update_material_quantity(db: Session, material_id: int, quantity_change: int, 
                              change_type: str, operator: str = None, remark: str = None,
                              source: models.RecordSource = None, related_record_code: str = None):
    material = get_material(db, material_id)
    if not material:
        return None
    
    quantity_before = material.quantity_available
    quantity_after = quantity_before + quantity_change
    
    if quantity_after < 0:
        raise ValueError(f"物料 {material.material_code} 可用数量不足")
    
    material.quantity_available = quantity_after
    
    log = models.InventoryLog(
        material_id=material_id,
        change_type=change_type,
        quantity_before=quantity_before,
        quantity_change=quantity_change,
        quantity_after=quantity_after,
        operator=operator,
        remark=remark,
        source=source,
        related_record_code=related_record_code
    )
    db.add(log)
    db.commit()
    return material


def create_booth(db: Session, booth: schemas.BoothCreate):
    db_booth = models.Booth(**booth.dict())
    db.add(db_booth)
    db.commit()
    db.refresh(db_booth)
    return db_booth


def get_booth(db: Session, booth_id: int):
    return db.query(models.Booth).filter(models.Booth.id == booth_id).first()


def get_booth_by_number(db: Session, booth_number: str):
    return db.query(models.Booth).filter(models.Booth.booth_number == booth_number).first()


def get_booths(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Booth).offset(skip).limit(limit).all()


def create_allocation(db: Session, allocation: schemas.AllocationCreate):
    material = get_material(db, allocation.material_id)
    if not material:
        raise ValueError("物料不存在")
    
    if material.quantity_available < allocation.quantity:
        raise ValueError(f"物料 {material.material_code} 可用数量不足")
    
    db_allocation = models.Allocation(**allocation.dict())
    db.add(db_allocation)
    
    update_material_quantity(
        db, allocation.material_id, -allocation.quantity,
        change_type="调拨占用",
        operator=allocation.operator,
        source=models.RecordSource.MANUAL,
        related_record_code=allocation.allocation_code
    )
    
    db.commit()
    db.refresh(db_allocation)
    return db_allocation


def get_allocation(db: Session, allocation_id: int):
    return db.query(models.Allocation).filter(models.Allocation.id == allocation_id).first()


def get_allocation_by_code(db: Session, allocation_code: str):
    return db.query(models.Allocation).filter(models.Allocation.allocation_code == allocation_code).first()


def get_allocations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Allocation).offset(skip).limit(limit).all()


def get_allocations_by_booth(db: Session, booth_id: int):
    return db.query(models.Allocation).filter(models.Allocation.booth_id == booth_id).all()


def return_allocation(db: Session, allocation_id: int, quantity_returned: int, 
                       quantity_damaged: int = 0, operator: str = None, remark: str = None):
    allocation = get_allocation(db, allocation_id)
    if not allocation:
        raise ValueError("调拨记录不存在")
    
    if quantity_returned > allocation.quantity:
        raise ValueError("归还数量不能大于调拨数量")
    
    record_code = generate_code("RET")
    return_record = models.ReturnRecord(
        record_code=record_code,
        material_id=allocation.material_id,
        booth_id=allocation.booth_id,
        allocation_id=allocation_id,
        quantity_returned=quantity_returned,
        quantity_damaged=quantity_damaged,
        operator=operator,
        remark=remark
    )
    db.add(return_record)
    
    usable_quantity = quantity_returned - quantity_damaged
    if usable_quantity > 0:
        update_material_quantity(
            db, allocation.material_id, usable_quantity,
            change_type="归还入库",
            operator=operator,
            source=models.RecordSource.MANUAL,
            related_record_code=record_code
        )
    
    allocation.returned_at = datetime.now()
    if quantity_returned == allocation.quantity:
        allocation.status = models.MaterialStatus.RETURNED
    else:
        allocation.quantity -= quantity_returned
    
    if quantity_damaged > 0:
        loss_code = generate_code("LOSS")
        loss_record = models.LossRecord(
            record_code=loss_code,
            material_id=allocation.material_id,
            quantity_lost=0,
            quantity_damaged=quantity_damaged,
            reason="归还时损坏",
            operator=operator,
            remark=f"关联归还记录: {record_code}"
        )
        db.add(loss_record)
    
    db.commit()
    return return_record


def create_transfer_order(db: Session, order: schemas.TransferOrderCreate):
    order_data = order.dict()
    items_data = order_data.pop("items")
    
    db_order = models.TransferOrder(**order_data)
    db.add(db_order)
    db.flush()
    
    for item_data in items_data:
        db_item = models.TransferItem(order_id=db_order.id, **item_data)
        db.add(db_item)
    
    db.commit()
    db.refresh(db_order)
    return db_order


def get_transfer_order(db: Session, order_id: int):
    return db.query(models.TransferOrder).filter(models.TransferOrder.id == order_id).first()


def get_transfer_order_by_code(db: Session, order_code: str):
    return db.query(models.TransferOrder).filter(models.TransferOrder.order_code == order_code).first()


def get_transfer_orders(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.TransferOrder).offset(skip).limit(limit).all()


def approve_transfer_order(db: Session, order_id: int, approver: str = None):
    order = get_transfer_order(db, order_id)
    if not order:
        raise ValueError("调拨单不存在")
    
    order.status = models.TransferStatus.APPROVED
    order.approver = approver
    order.approved_at = datetime.now()
    db.commit()
    return order


def complete_transfer_order(db: Session, order_id: int, operator: str = None):
    order = get_transfer_order(db, order_id)
    if not order:
        raise ValueError("调拨单不存在")
    
    for item in order.items:
        actual_qty = item.actual_quantity or item.quantity
        material = get_material(db, item.material_id)
        if material and material.quantity_available < actual_qty:
            raise ValueError(f"物料 {material.material_code} 可用数量不足")
    
    order.status = models.TransferStatus.IN_PROGRESS
    db.flush()
    
    for item in order.items:
        actual_qty = item.actual_quantity or item.quantity
        update_material_quantity(
            db, item.material_id, -actual_qty,
            change_type="调拨单出库",
            operator=operator,
            source=models.RecordSource.MANUAL,
            related_record_code=order.order_code
        )
    
    order.status = models.TransferStatus.COMPLETED
    order.completed_at = datetime.now()
    db.commit()
    return order


def create_loss_record(db: Session, loss: schemas.LossRecordCreate):
    db_loss = models.LossRecord(**loss.dict())
    db.add(db_loss)
    
    material = get_material(db, loss.material_id)
    if material:
        total_loss = loss.quantity_lost + loss.quantity_damaged
        if material.quantity_total >= total_loss:
            material.quantity_total -= total_loss
    
    db.commit()
    db.refresh(db_loss)
    return db_loss


def get_loss_records(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.LossRecord).offset(skip).limit(limit).all()


def create_import_error(db: Session, error: schemas.ImportErrorRecordCreate):
    db_error = models.ImportErrorRecord(**error.dict())
    db.add(db_error)
    db.commit()
    db.refresh(db_error)
    return db_error


def get_import_errors(db: Session, batch_id: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.ImportErrorRecord)
    if batch_id:
        query = query.filter(models.ImportErrorRecord.import_batch == batch_id)
    return query.offset(skip).limit(limit).all()


def get_inventory_logs(db: Session, material_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(models.InventoryLog)
    if material_id:
        query = query.filter(models.InventoryLog.material_id == material_id)
    return query.order_by(models.InventoryLog.created_at.desc()).offset(skip).limit(limit).all()


def get_inventory_report(db: Session) -> List[schemas.MaterialInventoryReport]:
    materials = get_materials(db)
    report = []
    
    for material in materials:
        allocated_qty = db.query(func.sum(models.Allocation.quantity))\
            .filter(models.Allocation.material_id == material.id)\
            .filter(models.Allocation.status.in_(
                [models.MaterialStatus.ALLOCATED, models.MaterialStatus.IN_USE]
            )).scalar() or 0
        
        returned_qty = db.query(func.sum(models.ReturnRecord.quantity_returned))\
            .filter(models.ReturnRecord.material_id == material.id).scalar() or 0
        
        lost_qty = db.query(func.sum(models.LossRecord.quantity_lost))\
            .filter(models.LossRecord.material_id == material.id).scalar() or 0
        
        damaged_qty = db.query(func.sum(models.LossRecord.quantity_damaged))\
            .filter(models.LossRecord.material_id == material.id).scalar() or 0
        
        report.append(schemas.MaterialInventoryReport(
            material_code=material.material_code,
            name=material.name,
            type=material.type,
            specification=material.specification,
            quantity_total=material.quantity_total,
            quantity_available=material.quantity_available,
            quantity_allocated=allocated_qty,
            quantity_in_use=allocated_qty,
            quantity_returned=returned_qty,
            quantity_lost=lost_qty,
            quantity_damaged=damaged_qty
        ))
    
    return report


def get_loss_report(db: Session) -> schemas.LossReport:
    loss_records = get_loss_records(db)
    materials = get_materials(db)
    
    items = []
    total_lost = 0
    total_damaged = 0
    
    material_losses = {}
    for record in loss_records:
        if record.material_id not in material_losses:
            material_losses[record.material_id] = {
                "lost": 0, "damaged": 0, "reason": record.reason,
                "responsible": record.responsible_person
            }
        material_losses[record.material_id]["lost"] += record.quantity_lost
        material_losses[record.material_id]["damaged"] += record.quantity_damaged
    
    for material in materials:
        loss_data = material_losses.get(material.id, {"lost": 0, "damaged": 0, "reason": None, "responsible": None})
        total = material.quantity_total
        loss_rate = (loss_data["lost"] + loss_data["damaged"]) / total if total > 0 else 0
        
        if loss_data["lost"] > 0 or loss_data["damaged"] > 0:
            items.append(schemas.LossReportItem(
                material_code=material.material_code,
                name=material.name,
                type=material.type,
                quantity_lost=loss_data["lost"],
                quantity_damaged=loss_data["damaged"],
                loss_rate=loss_rate,
                reason=loss_data["reason"],
                responsible_person=loss_data["responsible"]
            ))
        
        total_lost += loss_data["lost"]
        total_damaged += loss_data["damaged"]
    
    total_materials = sum(m.quantity_total for m in materials)
    overall_loss_rate = (total_lost + total_damaged) / total_materials if total_materials > 0 else 0
    
    return schemas.LossReport(
        report_date=datetime.now(),
        total_materials=total_materials,
        total_lost=total_lost,
        total_damaged=total_damaged,
        overall_loss_rate=overall_loss_rate,
        items=items
    )


def get_general_ledger_report(db: Session) -> schemas.GeneralLedgerReport:
    materials = get_materials(db)
    initial_total = sum(m.quantity_total for m in materials)
    
    total_allocated = db.query(func.sum(models.Allocation.quantity)).scalar() or 0
    total_returned = db.query(func.sum(models.ReturnRecord.quantity_returned)).scalar() or 0
    total_lost = db.query(func.sum(models.LossRecord.quantity_lost)).scalar() or 0
    total_damaged = db.query(func.sum(models.LossRecord.quantity_damaged)).scalar() or 0
    
    final_total = initial_total - total_lost - total_damaged
    discrepancy = final_total - sum(m.quantity_available for m in materials) - total_allocated + total_returned
    
    return schemas.GeneralLedgerReport(
        report_date=datetime.now(),
        initial_total=initial_total,
        total_allocated=total_allocated,
        total_returned=total_returned,
        total_lost=total_lost,
        total_damaged=total_damaged,
        final_total=final_total,
        is_balanced=abs(discrepancy) < 0.01,
        discrepancy=discrepancy
    )


def get_booth_allocations_report(db: Session) -> List[schemas.BoothAllocationItem]:
    allocations = db.query(models.Allocation).join(models.Booth).join(models.Material).all()
    
    items = []
    for alloc in allocations:
        items.append(schemas.BoothAllocationItem(
            booth_number=alloc.booth.booth_number,
            company_name=alloc.booth.company_name,
            material_code=alloc.material.material_code,
            material_name=alloc.material.name,
            material_type=alloc.material.type,
            quantity=alloc.quantity,
            status=alloc.status,
            allocated_at=alloc.allocated_at
        ))
    
    return items
