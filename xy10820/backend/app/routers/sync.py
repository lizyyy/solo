from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas, services
import io
import pandas as pd
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/import", response_model=schemas.SyncResponse)
def import_products(request: schemas.BatchImportRequest, db: Session = Depends(get_db)):
    batch = services.process_batch_import(db, request)
    return schemas.SyncResponse(
        success=True,
        batch_id=batch.batch_id,
        status=batch.status,
        message=f"Batch processed: {batch.success_items} success, {batch.failed_items} failed, {batch.conflict_items} conflicts"
    )


@router.get("/batches/", response_model=List[schemas.SyncBatch])
def list_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    batches = db.query(models.SyncBatch).order_by(
        models.SyncBatch.created_at.desc()
    ).offset(skip).limit(limit).all()
    return batches


@router.get("/batches/{batch_id}", response_model=schemas.SyncBatch)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(models.SyncBatch).filter(models.SyncBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.get("/batches/{batch_id}/conflicts", response_model=List[schemas.ConflictItem])
def get_batch_conflicts(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(models.SyncBatch).filter(models.SyncBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    conflicts = db.query(models.ConflictItem).filter(
        models.ConflictItem.batch_id == batch.id
    ).all()
    return conflicts


@router.get("/conflicts/", response_model=List[schemas.ConflictItem])
def list_conflicts(status: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.ConflictItem)
    if status:
        query = query.filter(models.ConflictItem.status == status)
    conflicts = query.order_by(models.ConflictItem.created_at.desc()).offset(skip).limit(limit).all()
    return conflicts


@router.put("/conflicts/{conflict_id}/resolve", response_model=schemas.ConflictItem)
def resolve_conflict(conflict_id: int, resolution: schemas.ConflictItemResolve, db: Session = Depends(get_db)):
    conflict = services.resolve_conflict(db, conflict_id, resolution)
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    return conflict


@router.get("/pending/", response_model=List[schemas.PendingConfirmation])
def list_pending_confirmations(status: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.PendingConfirmation)
    if status:
        query = query.filter(models.PendingConfirmation.status == status)
    pending = query.order_by(models.PendingConfirmation.created_at.desc()).offset(skip).limit(limit).all()
    return pending


@router.put("/pending/{pending_id}/confirm", response_model=schemas.PendingConfirmation)
def confirm_pending(pending_id: int, confirm: schemas.PendingConfirmationConfirm, db: Session = Depends(get_db)):
    pending = services.confirm_pending_value(db, pending_id, confirm)
    if not pending:
        raise HTTPException(status_code=404, detail="Pending confirmation not found")
    return pending


@router.post("/report")
def generate_report(request: schemas.ReportRequest, db: Session = Depends(get_db)):
    report = services.generate_report(db, request)
    return report


@router.post("/report/export")
def export_report(request: schemas.ReportRequest, db: Session = Depends(get_db)):
    report = services.generate_report(db, request)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame([report["summary"]]).to_excel(writer, sheet_name='Summary', index=False)
        
        if report.get("batches"):
            pd.DataFrame(report["batches"]).to_excel(writer, sheet_name='Batches', index=False)
        
        if report.get("conflicts"):
            pd.DataFrame(report["conflicts"]).to_excel(writer, sheet_name='Conflicts', index=False)
        
        if report.get("pending_confirmations"):
            pd.DataFrame(report["pending_confirmations"]).to_excel(writer, sheet_name='Pending', index=False)
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=supplier_mapping_report.xlsx"}
    )


@router.get("/compensation/", response_model=List[dict])
def list_compensation_logs(status: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = services.get_compensation_logs(db, status=status, skip=skip, limit=limit)
    return [
        {
            "id": log.id,
            "batch_id": log.batch_id,
            "action": log.action,
            "details": log.details,
            "status": log.status,
            "error_message": log.error_message,
            "retry_count": log.retry_count,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "completed_at": log.completed_at.isoformat() if log.completed_at else None
        }
        for log in logs
    ]


@router.get("/compensation/{log_id}", response_model=dict)
def get_compensation_log_detail(log_id: int, db: Session = Depends(get_db)):
    log = services.get_compensation_log(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Compensation log not found")
    return {
        "id": log.id,
        "batch_id": log.batch_id,
        "action": log.action,
        "details": log.details,
        "status": log.status,
        "error_message": log.error_message,
        "retry_count": log.retry_count,
        "created_at": log.created_at.isoformat() if log.created_at else None,
        "completed_at": log.completed_at.isoformat() if log.completed_at else None
    }


@router.post("/compensation/{log_id}/retry", response_model=dict)
def retry_compensation(log_id: int, db: Session = Depends(get_db)):
    log = services.retry_compensation(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Compensation log not found")
    return {
        "success": True,
        "message": f"Retry completed",
        "log_id": log.id,
        "status": log.status
    }


@router.post("/compensation/{log_id}/cancel", response_model=dict)
def cancel_compensation(log_id: int, db: Session = Depends(get_db)):
    log = services.cancel_compensation(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Compensation log not found")
    return {
        "success": True,
        "message": "Compensation cancelled",
        "log_id": log.id,
        "status": log.status
    }
