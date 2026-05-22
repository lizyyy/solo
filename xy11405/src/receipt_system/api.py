import uuid
import os
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from .database import get_db, init_db
from .models import (
    Batch, Receipt, Attachment, AuditLog, ReceiptStatus,
    AttachmentType, DuplicateAction
)
from .schemas import (
    BatchCreate, BatchResponse, ReceiptResponse, ReceiptCreate,
    BatchImportRequest, BatchImportResponse, ReceiptImportResult,
    ReviewRequest, FreezeRequest, UnfreezeRequest, ArchiveRequest,
    AttachmentResponse, AuditLogResponse, StatusTransitionResponse,
    AsyncTaskResponse, BatchSummaryResponse, ExportRequest, ErrorResponse
)
from .state_machine import ReceiptStateMachine, handle_duplicate_receipt, batch_state_summary, InvalidTransitionError
from .exporter import ReceiptExporter
from .task_processor import task_processor

app = FastAPI(
    title="乡镇药房近效期异常回执状态机 API",
    description="处理乡镇药房近效期异常回执状态管理系统",
    version="0.1.0"
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.post("/batches", response_model=BatchResponse, status_code=201)
def create_batch(batch_data: BatchCreate, db: Session = Depends(get_db)):
    batch_id = batch_data.batch_id or str(uuid.uuid4())
    existing_batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if existing_batch:
        raise HTTPException(status_code=400, detail=f"批次已存在: {batch_id}")

    batch = Batch(
        id=batch_id,
        pharmacy_id=batch_data.pharmacy_id,
        pharmacy_name=batch_data.pharmacy_name,
        region=batch_data.region,
        created_by=batch_data.created_by,
        description=batch_data.description,
    )
    db.add(batch)

    audit_log = AuditLog(
        batch_id=batch_id,
        action="创建批次",
        actor=batch_data.created_by,
        new_value={"pharmacy_name": batch_data.pharmacy_name, "region": batch_data.region}
    )
    db.add(audit_log)
    db.commit()
    db.refresh(batch)
    return batch


@app.get("/batches", response_model=List[BatchResponse])
def list_batches(
    region: Optional[str] = None,
    status: Optional[ReceiptStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Batch)
    if region:
        query = query.filter(Batch.region == region)
    if status:
        query = query.filter(Batch.status == status)
    return query.offset(skip).limit(limit).all()


@app.get("/batches/{batch_id}", response_model=BatchResponse)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.get("/batches/{batch_id}/summary", response_model=BatchSummaryResponse)
def get_batch_summary(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch_state_summary(batch)


@app.post("/batches/{batch_id}/import", response_model=BatchImportResponse)
def import_receipts(
    batch_id: str,
    import_data: BatchImportRequest,
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    created_count = 0
    updated_count = 0
    ignored_count = 0
    results = []

    for receipt_data in import_data.receipts:
        idempotency_key = receipt_data.idempotency_key or f"{batch_id}:{receipt_data.medicine_code}:{receipt_data.batch_number}"

        existing_receipt = db.query(Receipt).filter(
            Receipt.idempotency_key == idempotency_key
        ).first()

        existing_receipt_in_batch = db.query(Receipt).filter(
            Receipt.batch_id == batch_id,
            Receipt.medicine_code == receipt_data.medicine_code,
            Receipt.batch_number == receipt_data.batch_number
        ).first()

        if existing_receipt:
            receipt, action = handle_duplicate_receipt(
                db, existing_receipt, receipt_data.model_dump(), import_data.duplicate_action, batch.created_by
            )
            if action == "ignored":
                ignored_count += 1
            else:
                updated_count += 1
        elif existing_receipt_in_batch and import_data.duplicate_action != DuplicateAction.APPEND:
            receipt, action = handle_duplicate_receipt(
                db, existing_receipt_in_batch, receipt_data.model_dump(), import_data.duplicate_action, batch.created_by
            )
            if action == "ignored":
                ignored_count += 1
            else:
                updated_count += 1
        else:
            receipt = Receipt(
                id=str(uuid.uuid4()),
                batch_id=batch_id,
                idempotency_key=idempotency_key,
                medicine_code=receipt_data.medicine_code,
                medicine_name=receipt_data.medicine_name,
                specification=receipt_data.specification,
                batch_number=receipt_data.batch_number,
                expiry_date=receipt_data.expiry_date,
                quantity=receipt_data.quantity,
                unit=receipt_data.unit,
                original_price=receipt_data.original_price,
                adjusted_price=receipt_data.adjusted_price,
                source_type=receipt_data.source_type,
                metadata_=receipt_data.metadata or {}
            )
            db.add(receipt)
            created_count += 1
            action = "created"

        results.append(ReceiptImportResult(
            id=receipt.id,
            idempotency_key=receipt.idempotency_key,
            medicine_name=receipt.medicine_name,
            action_taken=action,
            status=receipt.status,
            version=receipt.version
        ))

    batch.total_receipts = db.query(Receipt).filter(Receipt.batch_id == batch_id).count()
    db.commit()

    return BatchImportResponse(
        batch_id=batch_id,
        total_processed=len(import_data.receipts),
        created=created_count,
        updated=updated_count,
        ignored=ignored_count,
        results=results
    )


@app.get("/batches/{batch_id}/receipts", response_model=List[ReceiptResponse])
def list_receipts(
    batch_id: str,
    status: Optional[ReceiptStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Receipt).filter(Receipt.batch_id == batch_id)
    if status:
        query = query.filter(Receipt.status == status)
    return query.offset(skip).limit(limit).all()


@app.post("/batches/{batch_id}/review")
def review_batch(
    batch_id: str,
    review_data: ReviewRequest,
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if review_data.receipt_ids:
        receipts = db.query(Receipt).filter(Receipt.id.in_(review_data.receipt_ids)).all()
    else:
        receipts = db.query(Receipt).filter(
            Receipt.batch_id == batch_id,
            Receipt.status == ReceiptStatus.PENDING_REVIEW
        ).all()

    success_count = 0
    failed_count = 0
    errors = []

    for receipt in receipts:
        try:
            sm = ReceiptStateMachine(receipt)
            if review_data.approved:
                sm.approve(db, review_data.reviewed_by, review_data.reason)
            else:
                sm.reject(db, review_data.reviewed_by, review_data.reason or "复核不通过")
            success_count += 1
        except InvalidTransitionError as e:
            failed_count += 1
            errors.append(f"{receipt.id}: {str(e)}")

    db.commit()

    return {
        "batch_id": batch_id,
        "success_count": success_count,
        "failed_count": failed_count,
        "errors": errors
    }


@app.post("/batches/{batch_id}/freeze")
def freeze_batch(
    batch_id: str,
    freeze_data: FreezeRequest,
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if freeze_data.receipt_ids:
        receipts = db.query(Receipt).filter(Receipt.id.in_(freeze_data.receipt_ids)).all()
    else:
        receipts = db.query(Receipt).filter(Receipt.batch_id == batch_id).all()

    success_count = 0
    failed_count = 0
    errors = []

    for receipt in receipts:
        try:
            sm = ReceiptStateMachine(receipt)
            sm.freeze(db, freeze_data.frozen_by, freeze_data.reason)
            success_count += 1
        except InvalidTransitionError as e:
            failed_count += 1
            errors.append(f"{receipt.id}: {str(e)}")

    batch.status = ReceiptStatus.FROZEN
    batch.frozen_at = datetime.now()
    batch.frozen_by = freeze_data.frozen_by
    db.commit()

    return {
        "batch_id": batch_id,
        "success_count": success_count,
        "failed_count": failed_count,
        "errors": errors
    }


@app.post("/batches/{batch_id}/unfreeze")
def unfreeze_batch(
    batch_id: str,
    unfreeze_data: UnfreezeRequest,
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if unfreeze_data.receipt_ids:
        receipts = db.query(Receipt).filter(Receipt.id.in_(unfreeze_data.receipt_ids)).all()
    else:
        receipts = db.query(Receipt).filter(
            Receipt.batch_id == batch_id,
            Receipt.status == ReceiptStatus.FROZEN
        ).all()

    success_count = 0
    failed_count = 0
    errors = []

    for receipt in receipts:
        try:
            sm = ReceiptStateMachine(receipt)
            sm.unfreeze(db, unfreeze_data.unfrozen_by, unfreeze_data.reason, unfreeze_data.target_status)
            success_count += 1
        except InvalidTransitionError as e:
            failed_count += 1
            errors.append(f"{receipt.id}: {str(e)}")

    remaining_frozen = db.query(Receipt).filter(
        Receipt.batch_id == batch_id,
        Receipt.status == ReceiptStatus.FROZEN

    ).count()
    if remaining_frozen == 0:
        batch.status = unfreeze_data.target_status
        batch.frozen_at = None
        batch.frozen_by = None
    db.commit()

    return {
        "batch_id": batch_id,
        "success_count": success_count,
        "failed_count": failed_count,
        "errors": errors
    }


@app.post("/batches/{batch_id}/archive")
def archive_batch(
    batch_id: str,
    archive_data: ArchiveRequest,
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if archive_data.receipt_ids:
        receipts = db.query(Receipt).filter(Receipt.id.in_(archive_data.receipt_ids)).all()
    else:
        receipts = db.query(Receipt).filter(Receipt.batch_id == batch_id).all()

    success_count = 0
    failed_count = 0
    errors = []

    for receipt in receipts:
        try:
            sm = ReceiptStateMachine(receipt)
            sm.archive(db, archive_data.archived_by, archive_data.reason)
            success_count += 1
        except InvalidTransitionError as e:
            failed_count += 1
            errors.append(f"{receipt.id}: {str(e)}")

    batch.status = ReceiptStatus.ARCHIVED
    db.commit()

    return {
        "batch_id": batch_id,
        "success_count": success_count,
        "failed_count": failed_count,
        "errors": errors
    }


@app.post("/batches/{batch_id}/attachments", response_model=AttachmentResponse)
async def upload_attachment(
    batch_id: str,
    attachment_type: AttachmentType,
    uploaded_by: str,
    receipt_id: Optional[str] = None,
    description: Optional[str] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    os.makedirs("attachments", exist_ok=True)
    file_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1]
    file_path = f"attachments/{file_id}{file_ext}"

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    attachment = Attachment(
        id=file_id,
        batch_id=batch_id,
        receipt_id=receipt_id,
        attachment_type=attachment_type,
        file_name=file.filename,
        file_path=file_path,
        file_size=len(content),
        uploaded_by=uploaded_by,
        description=description
    )
    db.add(attachment)

    audit_log = AuditLog(
        batch_id=batch_id,
        receipt_id=receipt_id,
        action="上传附件",
        actor=uploaded_by,
        new_value={"file_name": file.filename, "attachment_type": attachment_type.value}
    )
    db.add(audit_log)
    db.commit()
    db.refresh(attachment)
    return attachment


@app.get("/batches/{batch_id}/attachments", response_model=List[AttachmentResponse])
def list_attachments(batch_id: str, db: Session = Depends(get_db)):
    return db.query(Attachment).filter(Attachment.batch_id == batch_id).all()


@app.get("/batches/{batch_id}/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    batch_id: str,
    receipt_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog).filter(AuditLog.batch_id == batch_id)
    if receipt_id:
        query = query.filter(AuditLog.receipt_id == receipt_id)
    return query.order_by(AuditLog.action_at.desc()).offset(skip).limit(limit).all()


@app.get("/receipts/{receipt_id}/transitions", response_model=List[StatusTransitionResponse])
def get_status_transitions(receipt_id: str, db: Session = Depends(get_db)):
    from .models import StatusTransition
    return db.query(StatusTransition).filter(StatusTransition.receipt_id == receipt_id).order_by(StatusTransition.transitioned_at.desc()).all()


@app.get("/tasks", response_model=List[AsyncTaskResponse])
def list_tasks(
    batch_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from .models import AsyncTask, TaskStatus
    query = db.query(AsyncTask)
    if batch_id:
        query = query.filter(AsyncTask.batch_id == batch_id)
    if status:
        query = query.filter(AsyncTask.status == status)
    return query.all()


@app.post("/tasks/{task_id}/retry", response_model=AsyncTaskResponse)
def retry_task(task_id: str, actor: str, db: Session = Depends(get_db)):
    try:
        task = task_processor.retry_manual_task(db, task_id, actor)
        db.commit()
        db.refresh(task)
        return task
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/export")
def export_data(
    export_request: ExportRequest,
    db: Session = Depends(get_db)
):
    excel_data = ReceiptExporter.export_to_excel(
        db,
        batch_ids=export_request.batch_ids,
        region=export_request.region,
        status=export_request.status,
        include_audit_log=export_request.include_audit_log
    )

    summary = ReceiptExporter.get_export_summary(
        db,
        batch_ids=export_request.batch_ids,
        region=export_request.region
    )

    task_processor.create_task(
        db,
        task_type="export_batch",
        payload=summary,
        batch_id=export_request.batch_ids[0] if export_request.batch_ids else None
    )
    db.commit()

    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=receipt_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"}
    )


@app.get("/export/summary")
def get_export_summary(
    batch_ids: Optional[List[str]] = Query(None),
    region: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return ReceiptExporter.get_export_summary(db, batch_ids=batch_ids, region=region)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
