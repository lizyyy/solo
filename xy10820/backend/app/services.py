from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
import uuid
import json
from typing import List, Dict, Any, Optional
from . import models, schemas
from .models import SyncStatus, ConflictStatus, ConfirmationStatus


def generate_batch_id() -> str:
    return f"BATCH-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"


def check_idempotency(db: Session, idempotency_key: str) -> Optional[models.SyncBatch]:
    return db.query(models.SyncBatch).filter(
        models.SyncBatch.idempotency_key == idempotency_key
    ).first()


def create_compensation_log(db: Session, batch_id: str, action: str, details: Dict[str, Any]):
    log = models.CompensationLog(
        batch_id=batch_id,
        action=action,
        details=details,
        status="pending"
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_compensation_logs(db: Session, status: str = None, skip: int = 0, limit: int = 100):
    query = db.query(models.CompensationLog)
    if status:
        query = query.filter(models.CompensationLog.status == status)
    return query.order_by(models.CompensationLog.created_at.desc()).offset(skip).limit(limit).all()


def get_compensation_log(db: Session, log_id: int):
    return db.query(models.CompensationLog).filter(models.CompensationLog.id == log_id).first()


def retry_compensation(db: Session, log_id: int) -> Optional[models.CompensationLog]:
    log = db.query(models.CompensationLog).filter(models.CompensationLog.id == log_id).first()
    if not log:
        return None
    
    log.retry_count += 1
    log.status = "processing"
    
    try:
        if log.action == "process_product":
            details = log.details
            product_data = details.get("product_data", {})
            batch = db.query(models.SyncBatch).filter(models.SyncBatch.batch_id == log.batch_id).first()
            
            if batch and product_data:
                required_fields = ["sku", "name"]
                dirty_check = detect_dirty_data(product_data, required_fields)
                sku = product_data.get("sku", "")
                
                existing_product = db.query(models.SupplierProduct).filter(
                    and_(
                        models.SupplierProduct.supplier_id == batch.supplier_id,
                        models.SupplierProduct.supplier_sku == sku
                    )
                ).first()
                
                if not existing_product:
                    product = models.SupplierProduct(
                        supplier_id=batch.supplier_id,
                        supplier_sku=sku,
                        product_name=product_data.get("name"),
                        raw_data=product_data,
                        is_dirty=dirty_check["is_dirty"]
                    )
                    db.add(product)
                    batch.success_items += 1
                    if batch.failed_items > 0:
                        batch.failed_items -= 1
                
                elif existing_product and existing_product.raw_data != product_data:
                    conflict = models.ConflictItem(
                        batch_id=batch.id,
                        supplier_product_id=existing_product.id,
                        conflict_type="field_change",
                        old_value=existing_product.raw_data,
                        new_value=product_data,
                        status=ConflictStatus.OPEN
                    )
                    db.add(conflict)
                    batch.conflict_items += 1
                    if batch.failed_items > 0:
                        batch.failed_items -= 1
                    
                    pending = models.PendingConfirmation(
                        batch_id=batch.id,
                        supplier_product_id=existing_product.id,
                        field_name="product_data",
                        suggested_value=product_data,
                        current_value=existing_product.raw_data,
                        status=ConfirmationStatus.PENDING
                    )
                    db.add(pending)
                
                batch.processed_items = batch.success_items + batch.failed_items + batch.conflict_items
                
                if batch.conflict_items > 0:
                    batch.status = SyncStatus.CONFLICT
                elif batch.failed_items > 0:
                    batch.status = SyncStatus.PARTIAL
                else:
                    batch.status = SyncStatus.SUCCESS
        
        log.status = "success"
        log.completed_at = datetime.now()
        
    except Exception as e:
        log.status = "failed"
        log.error_message = str(e)
    
    db.commit()
    db.refresh(log)
    return log


def cancel_compensation(db: Session, log_id: int) -> Optional[models.CompensationLog]:
    log = db.query(models.CompensationLog).filter(models.CompensationLog.id == log_id).first()
    if not log:
        return None
    
    log.status = "cancelled"
    db.commit()
    db.refresh(log)
    return log


def detect_dirty_data(product_data: Dict[str, Any], required_fields: List[str]) -> Dict[str, Any]:
    issues = []
    missing_fields = []
    invalid_types = []
    
    for field in required_fields:
        if field not in product_data or product_data[field] is None:
            missing_fields.append(field)
        elif isinstance(product_data[field], str) and len(product_data[field].strip()) == 0:
            missing_fields.append(field)
    
    if missing_fields:
        issues.append({"type": "missing_fields", "fields": missing_fields})
    
    if "price" in product_data and product_data["price"] is not None:
        try:
            price = float(product_data["price"])
            if price < 0:
                invalid_types.append({"field": "price", "issue": "negative_value"})
        except (ValueError, TypeError):
            invalid_types.append({"field": "price", "issue": "invalid_number"})
    
    if invalid_types:
        issues.append({"type": "invalid_types", "details": invalid_types})
    
    return {
        "is_dirty": len(issues) > 0,
        "issues": issues
    }


def process_batch_import(db: Session, request: schemas.BatchImportRequest) -> models.SyncBatch:
    existing_batch = check_idempotency(db, request.idempotency_key)
    if existing_batch:
        return existing_batch
    
    batch_id = generate_batch_id()
    batch = models.SyncBatch(
        batch_id=batch_id,
        supplier_id=request.supplier_id,
        idempotency_key=request.idempotency_key,
        total_items=len(request.products),
        status=SyncStatus.PROCESSING,
        started_at=datetime.now()
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    required_fields = ["sku", "name"]
    success_count = 0
    failed_count = 0
    conflict_count = 0
    
    for product_data in request.products:
        try:
            dirty_check = detect_dirty_data(product_data, required_fields)
            sku = product_data.get("sku", "")
            
            existing_product = db.query(models.SupplierProduct).filter(
                and_(
                    models.SupplierProduct.supplier_id == request.supplier_id,
                    models.SupplierProduct.supplier_sku == sku
                )
            ).first()
            
            if existing_product:
                if existing_product.raw_data != product_data:
                    conflict = models.ConflictItem(
                        batch_id=batch.id,
                        supplier_product_id=existing_product.id,
                        conflict_type="field_change",
                        old_value=existing_product.raw_data,
                        new_value=product_data,
                        status=ConflictStatus.OPEN
                    )
                    db.add(conflict)
                    conflict_count += 1
                    
                    pending = models.PendingConfirmation(
                        batch_id=batch.id,
                        supplier_product_id=existing_product.id,
                        field_name="product_data",
                        suggested_value=product_data,
                        current_value=existing_product.raw_data,
                        status=ConfirmationStatus.PENDING
                    )
                    db.add(pending)
                success_count += 1
            else:
                product = models.SupplierProduct(
                    supplier_id=request.supplier_id,
                    supplier_sku=sku,
                    product_name=product_data.get("name"),
                    raw_data=product_data,
                    is_dirty=dirty_check["is_dirty"]
                )
                db.add(product)
                success_count += 1
            
            db.flush()
            
        except Exception as e:
            failed_count += 1
            create_compensation_log(
                db, batch_id, "process_product",
                {"product_data": product_data, "error": str(e)}
            )
    
    batch.processed_items = success_count + failed_count
    batch.success_items = success_count
    batch.failed_items = failed_count
    batch.conflict_items = conflict_count
    
    if conflict_count > 0:
        batch.status = SyncStatus.CONFLICT
    elif failed_count > 0:
        batch.status = SyncStatus.PARTIAL
    else:
        batch.status = SyncStatus.SUCCESS
    
    batch.completed_at = datetime.now()
    db.commit()
    db.refresh(batch)
    
    return batch


def resolve_conflict(db: Session, conflict_id: int, resolution: schemas.ConflictItemResolve) -> Optional[models.ConflictItem]:
    conflict = db.query(models.ConflictItem).filter(models.ConflictItem.id == conflict_id).first()
    if not conflict:
        return None
    
    conflict.status = ConflictStatus.RESOLVED
    conflict.resolution = resolution.resolution
    conflict.resolved_by = resolution.resolved_by
    conflict.resolved_at = datetime.now()
    
    if conflict.supplier_product_id:
        product = db.query(models.SupplierProduct).filter(
            models.SupplierProduct.id == conflict.supplier_product_id
        ).first()
        if product:
            if resolution.resolution.get("apply_changes", False):
                product.raw_data = conflict.new_value
                product.field_version += 1
            else:
                pass
    
    db.commit()
    db.refresh(conflict)
    return conflict


def confirm_pending_value(db: Session, pending_id: int, confirm: schemas.PendingConfirmationConfirm) -> Optional[models.PendingConfirmation]:
    pending = db.query(models.PendingConfirmation).filter(models.PendingConfirmation.id == pending_id).first()
    if not pending:
        return None
    
    pending.status = confirm.status
    pending.confirmed_value = confirm.confirmed_value
    pending.confirmed_by = confirm.confirmed_by
    pending.confirmed_at = datetime.now()
    
    if confirm.status == ConfirmationStatus.CONFIRMED and confirm.confirmed_value:
        product = db.query(models.SupplierProduct).filter(
            models.SupplierProduct.id == pending.supplier_product_id
        ).first()
        if product:
            product.raw_data = confirm.confirmed_value
    
    db.commit()
    db.refresh(pending)
    return pending


def add_mapping_timeline(db: Session, mapping_id: int, action: str, details: Dict[str, Any], performed_by: str = None):
    timeline = models.MappingTimeline(
        mapping_id=mapping_id,
        action=action,
        action_details=details,
        performed_by=performed_by
    )
    db.add(timeline)
    db.commit()
    return timeline


def generate_report(db: Session, request: schemas.ReportRequest) -> Dict[str, Any]:
    query = db.query(models.SyncBatch)
    
    if request.start_date:
        query = query.filter(models.SyncBatch.created_at >= request.start_date)
    if request.end_date:
        query = query.filter(models.SyncBatch.created_at <= request.end_date)
    if request.supplier_id:
        query = query.filter(models.SyncBatch.supplier_id == request.supplier_id)
    
    batches = query.all()
    
    report = {
        "summary": {
            "total_batches": len(batches),
            "total_items": sum(b.total_items for b in batches),
            "success_items": sum(b.success_items for b in batches),
            "failed_items": sum(b.failed_items for b in batches),
            "conflict_items": sum(b.conflict_items for b in batches),
        },
        "batches": [
            {
                "batch_id": b.batch_id,
                "status": b.status,
                "total_items": b.total_items,
                "success_items": b.success_items,
                "failed_items": b.failed_items,
                "conflict_items": b.conflict_items,
                "created_at": b.created_at.isoformat() if b.created_at else None
            }
            for b in batches
        ]
    }
    
    if request.include_conflicts:
        conflicts = db.query(models.ConflictItem).filter(
            models.ConflictItem.batch_id.in_([b.id for b in batches])
        ).all()
        report["conflicts"] = [
            {
                "id": c.id,
                "conflict_type": c.conflict_type,
                "field_name": c.field_name,
                "status": c.status,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in conflicts
        ]
    
    if request.include_pending:
        pending = db.query(models.PendingConfirmation).filter(
            models.PendingConfirmation.batch_id.in_([b.id for b in batches])
        ).all()
        report["pending_confirmations"] = [
            {
                "id": p.id,
                "field_name": p.field_name,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None
            }
            for p in pending
        ]
    
    return report
