from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
from datetime import datetime

from database import get_db
from models import Receipt, Attachment
from schemas import (
    ReceiptResponse, ReceiptReview, ReceiptOverrule,
    AttachmentResponse
)
from services import review_receipt, overrule_receipt, create_operation_log, OperationType

router = APIRouter()

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/", response_model=List[ReceiptResponse])
def list_receipts(
    batch_id: int = None,
    status: str = None,
    room_no: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Receipt)
    if batch_id:
        query = query.filter(Receipt.batch_id == batch_id)
    if status:
        query = query.filter(Receipt.status == status)
    if room_no:
        query = query.filter(Receipt.room_no == room_no)
    return query.order_by(Receipt.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/{receipt_id}", response_model=ReceiptResponse)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")
    return receipt

@router.post("/{receipt_id}/review", response_model=ReceiptResponse)
def review_receipt_endpoint(receipt_id: int, data: ReceiptReview, db: Session = Depends(get_db)):
    try:
        return review_receipt(
            db=db,
            receipt_id=receipt_id,
            review_result=data.review_result,
            review_reason=data.review_reason,
            reviewed_by=data.reviewed_by
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{receipt_id}/overrule", response_model=ReceiptResponse)
def overrule_receipt_endpoint(receipt_id: int, data: ReceiptOverrule, db: Session = Depends(get_db)):
    try:
        return overrule_receipt(
            db=db,
            receipt_id=receipt_id,
            new_status=data.new_status,
            overrule_reason=data.overrule_reason,
            overruled_by=data.overruled_by
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{receipt_id}/upload")
async def upload_receipt_attachment(
    receipt_id: int,
    file: UploadFile = File(...),
    source_type: str = Form(...),
    uploaded_by: str = Form(...),
    remark: str = Form(None),
    db: Session = Depends(get_db)
):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="回执不存在")
    
    from models import Batch
    batch = db.query(Batch).filter(Batch.id == receipt.batch_id).first()
    if batch and batch.is_frozen:
        raise HTTPException(status_code=400, detail="批次已冻结，无法上传附件")
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    safe_filename = f"receipt_{receipt_id}_{timestamp}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_size = os.path.getsize(file_path)
    
    attachment = Attachment(
        receipt_id=receipt_id,
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
        receipt_id=receipt_id,
        after_state={"file_name": file.filename, "file_size": file_size},
        remark=f"上传回执附件: {file.filename}"
    )
    
    db.commit()
    db.refresh(attachment)
    return attachment

@router.get("/{receipt_id}/attachments", response_model=List[AttachmentResponse])
def get_receipt_attachments(receipt_id: int, db: Session = Depends(get_db)):
    return db.query(Attachment).filter(Attachment.receipt_id == receipt_id).order_by(Attachment.created_at.desc()).all()
