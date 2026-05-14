from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import uuid
import json
from datetime import datetime
import httpx

from database import get_db, init_db, WebhookRecord
from schemas import (
    WebhookCreate,
    WebhookUpdate,
    WebhookResponse,
    WebhookFilter,
    VerifyRequest,
    RetryRequest,
    ExportRequest,
)

app = FastAPI(title="Webhook重放排障台")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.post("/api/webhooks", response_model=WebhookResponse)
def create_webhook(webhook: WebhookCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(WebhookRecord)
        .filter(WebhookRecord.idempotency_key == webhook.idempotency_key)
        .first()
    )
    if existing:
        return existing

    record_id = str(uuid.uuid4())

    max_position = db.query(func.max(WebhookRecord.queue_position)).scalar() or 0

    db_record = WebhookRecord(
        id=record_id,
        idempotency_key=webhook.idempotency_key,
        signature_key=webhook.signature_key,
        event_payload=webhook.event_payload,
        target_url=webhook.target_url,
        max_retries=webhook.max_retries,
        queue_position=max_position + 1,
        status="pending",
    )

    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    return db_record


@app.get("/api/webhooks", response_model=dict)
def list_webhooks(
    status: str = None,
    signature_key: str = None,
    idempotency_key: str = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    query = db.query(WebhookRecord)

    if status:
        query = query.filter(WebhookRecord.status == status)
    if signature_key:
        query = query.filter(WebhookRecord.signature_key.like(f"%{signature_key}%"))
    if idempotency_key:
        query = query.filter(
            WebhookRecord.idempotency_key.like(f"%{idempotency_key}%")
        )

    total = query.count()

    records = (
        query.order_by(WebhookRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": records,
    }


@app.get("/api/webhooks/{record_id}", response_model=WebhookResponse)
def get_webhook(record_id: str, db: Session = Depends(get_db)):
    record = db.query(WebhookRecord).filter(WebhookRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@app.put("/api/webhooks/{record_id}", response_model=WebhookResponse)
def update_webhook(
    record_id: str, update: WebhookUpdate, db: Session = Depends(get_db)
):
    record = db.query(WebhookRecord).filter(WebhookRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    update_data = update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)

    return record


@app.post("/api/webhooks/verify", response_model=WebhookResponse)
def verify_webhook(request: VerifyRequest, db: Session = Depends(get_db)):
    record = (
        db.query(WebhookRecord).filter(WebhookRecord.id == request.record_id).first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    record.is_verified = True
    record.verified_by = request.verified_by
    record.verified_at = datetime.utcnow()
    record.status = "verified"

    if request.notes:
        if record.processing_report:
            try:
                report = json.loads(record.processing_report)
            except:
                report = {}
        else:
            report = {}
        report["verification_notes"] = request.notes
        record.processing_report = json.dumps(report, ensure_ascii=False)

    db.commit()
    db.refresh(record)

    return record


@app.post("/api/webhooks/retry", response_model=WebhookResponse)
async def retry_webhook(request: RetryRequest, db: Session = Depends(get_db)):
    record = (
        db.query(WebhookRecord).filter(WebhookRecord.id == request.record_id).first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if not request.force and record.retry_count >= record.max_retries:
        raise HTTPException(
            status_code=400, detail="Max retries exceeded. Use force=true to override."
        )

    record.status = "retrying"
    record.retry_count += 1
    record.updated_at = datetime.utcnow()
    db.commit()

    try:
        if record.target_url:
            async with httpx.AsyncClient(timeout=30.0) as client:
                headers = {
                    "X-Idempotency-Key": record.idempotency_key,
                    "X-Signature": record.signature_key,
                    "Content-Type": "application/json",
                }
                response = await client.post(
                    record.target_url,
                    content=record.event_payload,
                    headers=headers,
                )

                report = {
                    "retry_attempt": record.retry_count,
                    "timestamp": datetime.utcnow().isoformat(),
                    "status_code": response.status_code,
                    "response": response.text[:5000],
                }

                if response.status_code >= 200 and response.status_code < 300:
                    record.status = "success"
                    record.processed_at = datetime.utcnow()
                    report["result"] = "success"
                else:
                    record.status = "failed"
                    record.error_reason = f"HTTP {response.status_code}: {response.text[:200]}"
                    report["result"] = "failed"
                    report["error"] = record.error_reason

                record.processing_report = json.dumps(report, ensure_ascii=False)
        else:
            record.status = "success"
            record.processed_at = datetime.utcnow()
            report = {
                "retry_attempt": record.retry_count,
                "timestamp": datetime.utcnow().isoformat(),
                "result": "simulated_success",
                "note": "No target URL configured - marked as success",
            }
            record.processing_report = json.dumps(report, ensure_ascii=False)

    except Exception as e:
        record.status = "failed"
        record.error_reason = str(e)
        report = {
            "retry_attempt": record.retry_count,
            "timestamp": datetime.utcnow().isoformat(),
            "result": "failed",
            "error": str(e),
        }
        record.processing_report = json.dumps(report, ensure_ascii=False)

    db.commit()
    db.refresh(record)

    return record


@app.post("/api/webhooks/export")
def export_webhooks(request: ExportRequest, db: Session = Depends(get_db)):
    query = db.query(WebhookRecord)

    if request.status:
        query = query.filter(WebhookRecord.status == request.status)
    if request.start_date:
        try:
            start_dt = datetime.fromisoformat(request.start_date)
            query = query.filter(WebhookRecord.created_at >= start_dt)
        except:
            pass
    if request.end_date:
        try:
            end_dt = datetime.fromisoformat(request.end_date)
            query = query.filter(WebhookRecord.created_at <= end_dt)
        except:
            pass

    records = query.order_by(WebhookRecord.created_at.desc()).all()

    export_data = []
    for record in records:
        export_data.append(
            {
                "id": record.id,
                "idempotency_key": record.idempotency_key,
                "signature_key": record.signature_key,
                "status": record.status,
                "error_reason": record.error_reason,
                "retry_count": record.retry_count,
                "created_at": record.created_at.isoformat() if record.created_at else None,
                "processed_at": record.processed_at.isoformat()
                if record.processed_at
                else None,
                "is_verified": record.is_verified,
                "verified_by": record.verified_by,
            }
        )

    return {"count": len(export_data), "data": export_data}


@app.get("/api/statistics")
def get_statistics(db: Session = Depends(get_db)):
    total = db.query(WebhookRecord).count()
    pending = db.query(WebhookRecord).filter(WebhookRecord.status == "pending").count()
    failed = db.query(WebhookRecord).filter(WebhookRecord.status == "failed").count()
    success = db.query(WebhookRecord).filter(WebhookRecord.status == "success").count()
    verified = db.query(WebhookRecord).filter(WebhookRecord.is_verified == True).count()

    return {
        "total": total,
        "pending": pending,
        "failed": failed,
        "success": success,
        "verified": verified,
    }


@app.delete("/api/webhooks/{record_id}")
def delete_webhook(record_id: str, db: Session = Depends(get_db)):
    record = db.query(WebhookRecord).filter(WebhookRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    db.delete(record)
    db.commit()

    return {"message": "Record deleted successfully"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
