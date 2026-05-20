from sqlalchemy.orm import Session
from sqlalchemy import func
import hashlib
import json
from typing import List, Optional
from app import models, schemas
from app.models import MaterialStatus, ChangeType


def generate_material_hash(work_order: str, workstation: Optional[str] = None, 
                          material_batch: Optional[str] = None, raw_data: Optional[str] = None) -> str:
    """生成材料的唯一哈希值，用于去重识别"""
    hash_input = f"{work_order}:{workstation or ''}:{material_batch or ''}:{raw_data or ''}"
    return hashlib.md5(hash_input.encode('utf-8')).hexdigest()


def get_batch(db: Session, batch_id: int):
    return db.query(models.Batch).filter(models.Batch.id == batch_id).first()


def get_batch_by_number(db: Session, batch_number: str):
    return db.query(models.Batch).filter(models.Batch.batch_number == batch_number).first()


def get_batches(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Batch).offset(skip).limit(limit).all()


def create_batch(db: Session, batch: schemas.BatchCreate):
    db_batch = models.Batch(**batch.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def get_material(db: Session, material_id: int):
    return db.query(models.Material).filter(models.Material.id == material_id).first()


def get_material_by_hash(db: Session, material_hash: str):
    return db.query(models.Material).filter(models.Material.material_hash == material_hash).first()


def get_materials(db: Session, batch_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Material)
    if batch_id:
        query = query.filter(models.Material.batch_id == batch_id)
    return query.offset(skip).limit(limit).all()


def create_material(db: Session, material: schemas.MaterialCreate):
    material_hash = generate_material_hash(
        work_order=material.work_order,
        workstation=material.workstation,
        material_batch=material.material_batch,
        raw_data=material.raw_data
    )
    
    existing_material = get_material_by_hash(db, material_hash)
    if existing_material:
        return existing_material, False
    
    db_material = models.Material(
        **material.model_dump(),
        material_hash=material_hash,
        status=MaterialStatus.PENDING
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material, True


def update_material(db: Session, material_id: int, material_update: schemas.MaterialUpdate, 
                   operator: str, change_reason: str):
    db_material = get_material(db, material_id)
    if not db_material:
        return None
    
    old_values = {}
    update_data = material_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        old_value = getattr(db_material, key)
        if old_value != value:
            old_values[key] = str(old_value)
            setattr(db_material, key, value)
    
    if old_values:
        audit_log = models.AuditLog(
            material_id=material_id,
            change_type=ChangeType.CONCLUSION_CHANGE if 'conclusion' in old_values else ChangeType.STATUS_CHANGE,
            operator=operator,
            change_reason=change_reason,
            old_value=json.dumps(old_values),
            new_value=json.dumps({k: str(update_data[k]) for k in old_values.keys()})
        )
        db.add(audit_log)
    
    if 'status' in update_data and update_data['status'] == MaterialStatus.COMPLETED:
        db_material.final_processor = operator
    
    db.commit()
    db.refresh(db_material)
    return db_material


def get_audit_logs(db: Session, material_id: int):
    return db.query(models.AuditLog).filter(models.AuditLog.material_id == material_id).order_by(models.AuditLog.changed_at.desc()).all()


def trigger_review(db: Session, material_id: int, reviewer: str, review_comment: str, review_result: str):
    db_material = get_material(db, material_id)
    if not db_material:
        return None
    
    old_status = db_material.status
    db_material.status = MaterialStatus.REVIEWING
    
    review_record = models.ReviewRecord(
        material_id=material_id,
        reviewer=reviewer,
        review_comment=review_comment,
        review_result=review_result
    )
    db.add(review_record)
    
    audit_log = models.AuditLog(
        material_id=material_id,
        change_type=ChangeType.STATUS_CHANGE,
        operator=reviewer,
        change_reason=f"触发复核流程: {review_comment}",
        old_value=old_status,
        new_value=MaterialStatus.REVIEWING
    )
    db.add(audit_log)
    
    db.commit()
    db.refresh(db_material)
    return db_material


def complete_review(db: Session, material_id: int, reviewer: str, final_conclusion: str, change_reason: str):
    db_material = get_material(db, material_id)
    if not db_material:
        return None
    
    old_conclusion = db_material.conclusion
    old_status = db_material.status
    
    db_material.conclusion = final_conclusion
    db_material.status = MaterialStatus.COMPLETED
    db_material.final_processor = reviewer
    
    audit_log = models.AuditLog(
        material_id=material_id,
        change_type=ChangeType.CONCLUSION_CHANGE,
        operator=reviewer,
        change_reason=change_reason,
        old_value=old_conclusion or "无结论",
        new_value=final_conclusion
    )
    db.add(audit_log)
    
    db.commit()
    db.refresh(db_material)
    return db_material


def get_material_with_audit(db: Session, material_id: int):
    material = get_material(db, material_id)
    if not material:
        return None
    audit_logs = get_audit_logs(db, material_id)
    return {
        "material": material,
        "audit_logs": audit_logs
    }


def get_statistics(db: Session):
    total = db.query(func.count(models.Material.id)).scalar()
    pending = db.query(func.count(models.Material.id)).filter(models.Material.status == MaterialStatus.PENDING).scalar()
    processing = db.query(func.count(models.Material.id)).filter(models.Material.status == MaterialStatus.PROCESSING).scalar()
    completed = db.query(func.count(models.Material.id)).filter(models.Material.status == MaterialStatus.COMPLETED).scalar()
    rejected = db.query(func.count(models.Material.id)).filter(models.Material.status == MaterialStatus.REJECTED).scalar()
    
    top_reasons = db.query(
        models.Material.rework_reason,
        func.count(models.Material.id).label('count')
    ).filter(
        models.Material.rework_reason.isnot(None)
    ).group_by(
        models.Material.rework_reason
    ).order_by(
        func.count(models.Material.id).desc()
    ).limit(10).all()
    
    top_workstations = db.query(
        models.Material.workstation,
        func.count(models.Material.id).label('count')
    ).filter(
        models.Material.workstation.isnot(None)
    ).group_by(
        models.Material.workstation
    ).order_by(
        func.count(models.Material.id).desc()
    ).limit(10).all()
    
    return {
        "total_materials": total,
        "pending_count": pending,
        "processing_count": processing,
        "completed_count": completed,
        "rejected_count": rejected,
        "top_reasons": [{"reason": r[0], "count": r[1]} for r in top_reasons],
        "top_workstations": [{"workstation": w[0], "count": w[1]} for w in top_workstations]
    }


def get_export_data(db: Session, batch_id: Optional[int] = None):
    query = db.query(models.Material)
    if batch_id:
        query = query.filter(models.Material.batch_id == batch_id)
    
    materials = query.all()
    return [
        {
            "work_order": m.work_order,
            "rework_reason": m.rework_reason,
            "workstation": m.workstation,
            "material_batch": m.material_batch,
            "conclusion": m.conclusion,
            "final_processor": m.final_processor,
            "status": m.status,
            "created_at": m.created_at
        }
        for m in materials
    ]
