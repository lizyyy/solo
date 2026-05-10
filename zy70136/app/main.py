from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db, init_db
from app.models import RetryType, RetryStatus
from app.schemas import (
    CreateSignApplicationRequest, SignApplicationResponse,
    UploadQualificationRequest, QualificationResponse,
    ChannelSubmitRequest, ChannelReceiptRequest,
    RetryQueueResponse, AuditReportResponse
)
from app.services import (
    create_sign_application, get_application_by_id,
    submit_for_qualification, upload_qualification,
    approve_qualification, reject_qualification,
    submit_to_channel, receive_channel_receipt, parse_channel_receipt,
    add_to_retry_queue, get_pending_retries, execute_retry, get_retry_by_id,
    process_batch_retries,
    generate_audit_report, get_application_history,
    trace_application_by_request_id
)

app = FastAPI(title="短信签名审核队列服务", version="1.0.0")


@app.on_event("startup")
def startup_event():
    init_db()


@app.post("/api/v1/signs", response_model=SignApplicationResponse)
def create_sign(
    request: CreateSignApplicationRequest,
    db: Session = Depends(get_db)
):
    application, msg = create_sign_application(db, request)
    if not application:
        raise HTTPException(status_code=400, detail=msg)
    return application


@app.get("/api/v1/signs/{application_id}", response_model=SignApplicationResponse)
def get_sign(
    application_id: int,
    db: Session = Depends(get_db)
):
    application = get_application_by_id(db, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="签名申请不存在")
    return application


@app.post("/api/v1/signs/{application_id}/submit-qualification")
def submit_qualification(
    application_id: int,
    request: dict,
    db: Session = Depends(get_db)
):
    request_id = request.get("request_id")
    if not request_id:
        raise HTTPException(status_code=400, detail="request_id 不能为空")
    
    application, msg = submit_for_qualification(db, application_id, request_id)
    if not application:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg, "application_id": application.id}


@app.post("/api/v1/qualifications", response_model=QualificationResponse)
def upload_qual(
    request: UploadQualificationRequest,
    db: Session = Depends(get_db)
):
    qualification, msg = upload_qualification(db, request)
    if not qualification:
        raise HTTPException(status_code=400, detail=msg)
    return qualification


@app.post("/api/v1/qualifications/{qualification_id}/approve")
def approve_qual(
    qualification_id: int,
    request: dict,
    db: Session = Depends(get_db)
):
    reviewer_id = request.get("reviewer_id", "system")
    request_id = request.get("request_id")
    comment = request.get("comment")
    
    if not request_id:
        raise HTTPException(status_code=400, detail="request_id 不能为空")
    
    qualification, msg = approve_qualification(db, qualification_id, reviewer_id, request_id, comment)
    if not qualification:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg, "qualification_id": qualification.id}


@app.post("/api/v1/qualifications/{qualification_id}/reject")
def reject_qual(
    qualification_id: int,
    request: dict,
    db: Session = Depends(get_db)
):
    reviewer_id = request.get("reviewer_id", "system")
    request_id = request.get("request_id")
    comment = request.get("comment")
    
    if not request_id or not comment:
        raise HTTPException(status_code=400, detail="request_id 和 comment 不能为空")
    
    qualification, msg = reject_qualification(db, qualification_id, reviewer_id, request_id, comment)
    if not qualification:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg, "qualification_id": qualification.id}


@app.post("/api/v1/channels/submit")
def submit_channel(
    request: ChannelSubmitRequest,
    db: Session = Depends(get_db)
):
    application, msg = submit_to_channel(db, request)
    if not application:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg, "application_id": application.id}


@app.post("/api/v1/channels/receipts")
def receive_receipt(
    request: ChannelReceiptRequest,
    db: Session = Depends(get_db)
):
    receipt, msg = receive_channel_receipt(db, request)
    if not receipt:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg, "receipt_id": receipt.id}


@app.post("/api/v1/channels/receipts/{receipt_id}/parse")
def parse_receipt(
    receipt_id: int,
    db: Session = Depends(get_db)
):
    receipt, msg = parse_channel_receipt(db, receipt_id)
    if not receipt:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg, "receipt_id": receipt.id}


@app.post("/api/v1/retries")
def add_retry(
    request: dict,
    db: Session = Depends(get_db)
):
    retry_type = request.get("retry_type")
    target_id = request.get("target_id")
    last_error = request.get("last_error")
    
    if not retry_type or not target_id:
        raise HTTPException(status_code=400, detail="retry_type 和 target_id 不能为空")
    
    try:
        retry_type_enum = RetryType(retry_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效的重试类型: {retry_type}")
    
    retry, msg = add_to_retry_queue(db, retry_type_enum, str(target_id), last_error=last_error)
    if not retry:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg, "retry_id": retry.id}


@app.get("/api/v1/retries/pending", response_model=List[RetryQueueResponse])
def list_pending_retries(
    db: Session = Depends(get_db)
):
    return get_pending_retries(db)


@app.post("/api/v1/retries/{retry_id}/execute")
def run_retry(
    retry_id: int,
    db: Session = Depends(get_db)
):
    success, msg = execute_retry(db, retry_id)
    status = "success" if success else "failed"
    return {"status": status, "message": msg, "retry_id": retry_id}


@app.post("/api/v1/retries/process-batch")
def run_batch_retries(
    db: Session = Depends(get_db)
):
    results = process_batch_retries(db)
    return {"status": "success", "results": results}


@app.get("/api/v1/reports/{application_id}", response_model=AuditReportResponse)
def get_report(
    application_id: int,
    db: Session = Depends(get_db)
):
    report, msg = generate_audit_report(db, application_id)
    if not report:
        raise HTTPException(status_code=400, detail=msg)
    return report


@app.get("/api/v1/signs/{application_id}/history")
def get_history(
    application_id: int,
    db: Session = Depends(get_db)
):
    return get_application_history(db, application_id)


@app.get("/api/v1/trace/{request_id}")
def trace_by_request_id(
    request_id: str,
    db: Session = Depends(get_db)
):
    return trace_application_by_request_id(db, request_id)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "sms-sign-audit-service"}
