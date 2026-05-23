from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
from datetime import datetime

from database import get_db
from models import Batch, Receipt, Attachment, BatchStatus, SourceType
from schemas import (
    BatchCreate, BatchUpdate, BatchResponse, BatchDetail,
    ReceiptImportItem, ImportResult, BatchFreeze, BatchWithdraw,
    AttachmentResponse
)
from services import (
    create_batch, import_receipts, freeze_batch, withdraw_batch,
    resubmit_batch, archive_batch, create_operation_log, OperationType
)

router = APIRouter()

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=BatchResponse)
def create_new_batch(batch_data: BatchCreate, db: Session = Depends(get_db)):
    try:
        return create_batch(db, batch_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[BatchResponse])
def list_batches(skip: int = 0, limit: int = 100, status: str = None, db: Session = Depends(get_db)):
    query = db.query(Batch)
    if status:
        query = query.filter(Batch.status == status)
    return query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/{batch_id}", response_model=BatchDetail)
def get_batch_detail(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    receipts = batch.receipts
    status_counts = {}
    for r in receipts:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1
    
    return {
        "id": batch.id,
        "batch_no": batch.batch_no,
        "name": batch.name,
        "source_type": batch.source_type,
        "operator": batch.operator,
        "store_code": batch.store_code,
        "remark": batch.remark,
        "status": batch.status,
        "is_frozen": batch.is_frozen,
        "frozen_at": batch.frozen_at,
        "frozen_by": batch.frozen_by,
        "frozen_reason": batch.frozen_reason,
        "created_at": batch.created_at,
        "updated_at": batch.updated_at,
        "receipt_count": len(receipts),
        "confirmed_count": status_counts.get("confirmed", 0),
        "disputed_count": status_counts.get("disputed", 0),
        "pending_count": status_counts.get("pending", 0)
    }

@router.post("/{batch_id}/import", response_model=ImportResult)
def import_batch_receipts(
    batch_id: int,
    items: List[ReceiptImportItem],
    source_file: str = Form(...),
    operator: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        return import_receipts(db, batch_id, items, source_file, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{batch_id}/upload")
async def upload_attachment(
    batch_id: int,
    file: UploadFile = File(...),
    source_type: str = Form(...),
    uploaded_by: str = Form(...),
    remark: str = Form(None),
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if batch.is_frozen:
        raise HTTPException(status_code=400, detail="批次已冻结，无法上传附件")
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{batch_id}_{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_size = os.path.getsize(file_path)
    
    attachment = Attachment(
        batch_id=batch_id,
        file_name=file.filename,
        file_path=file_path,
        file_size=file_size,
        file_type=file.content_type,
        source_type=source_type,
        uploaded_by=uploaded_by,
        remark=remark
    )
    db.add(attachment)
    db.flush()
    
    create_operation_log(
        db=db,
        operation_type=OperationType.ATTACHMENT_UPLOAD,
        operator=uploaded_by,
        batch_id=batch_id,
        after_state={"file_name": file.filename, "file_size": file_size},
        remark=f"上传附件: {file.filename}"
    )
    
    db.commit()
    db.refresh(attachment)
    return attachment

@router.get("/{batch_id}/attachments", response_model=List[AttachmentResponse])
def get_batch_attachments(batch_id: int, db: Session = Depends(get_db)):
    return db.query(Attachment).filter(Attachment.batch_id == batch_id).order_by(Attachment.created_at.desc()).all()

@router.post("/{batch_id}/freeze", response_model=BatchResponse)
def freeze_batch_endpoint(batch_id: int, data: BatchFreeze, db: Session = Depends(get_db)):
    try:
        return freeze_batch(db, batch_id, data.frozen_by, data.frozen_reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{batch_id}/withdraw", response_model=BatchResponse)
def withdraw_batch_endpoint(batch_id: int, data: BatchWithdraw, db: Session = Depends(get_db)):
    try:
        return withdraw_batch(db, batch_id, data.operator, data.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{batch_id}/resubmit", response_model=BatchResponse)
def resubmit_batch_endpoint(batch_id: int, operator: str = Form(...), db: Session = Depends(get_db)):
    try:
        return resubmit_batch(db, batch_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{batch_id}/archive", response_model=BatchResponse)
def archive_batch_endpoint(batch_id: int, operator: str = Form(...), db: Session = Depends(get_db)):
    try:
        return archive_batch(db, batch_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
