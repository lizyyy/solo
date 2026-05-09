from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, List
from io import BytesIO
from database import get_db, LogEntry, IdempotencyRecord
from schemas import LogEntryCreate, LogEntryResponse, LogQuery, LogLevel, LogIngestRequest
from services.audit_service import AuditService
from config import settings
from datetime import datetime, timedelta

router = APIRouter(prefix="/logs", tags=["日志"])


def _check_idempotency(
    db: Session,
    idempotency_key: Optional[str],
    endpoint: str
):
    if not idempotency_key:
        return None
    
    record = db.query(IdempotencyRecord).filter(
        IdempotencyRecord.idempotency_key == idempotency_key,
        IdempotencyRecord.endpoint == endpoint
    ).first()
    
    if record:
        return record
    
    return None


def _save_idempotency(
    db: Session,
    idempotency_key: str,
    endpoint: str,
    response_code: int,
    response_body: dict
):
    record = IdempotencyRecord(
        idempotency_key=idempotency_key,
        endpoint=endpoint,
        response_code=response_code,
        response_body=response_body
    )
    db.add(record)
    db.commit()


def _cleanup_expired_idempotency(db: Session):
    cutoff = datetime.now() - timedelta(hours=settings.IDEMPOTENCY_EXPIRE_HOURS)
    db.query(IdempotencyRecord).filter(
        IdempotencyRecord.created_at < cutoff
    ).delete()
    db.commit()


@router.post("/ingest", status_code=201)
def ingest_logs(
    ingest_data: LogIngestRequest,
    request: Request,
    db: Session = Depends(get_db),
    x_idempotency_key: Optional[str] = Header(None)
):
    endpoint = request.url.path
    
    _cleanup_expired_idempotency(db)
    
    cached = _check_idempotency(db, x_idempotency_key, endpoint)
    if cached:
        return cached.response_body
    
    count = 0
    for log_data in ingest_data.logs:
        entry = LogEntry(
            source_id=log_data.source_id,
            log_time=log_data.log_time,
            log_level=log_data.log_level.value,
            message=log_data.message,
            module=log_data.module,
            trace_id=log_data.trace_id,
            extra_data=log_data.extra_data
        )
        db.add(entry)
        count += 1
    
    db.commit()
    
    response = {
        "message": "日志写入成功",
        "count": count
    }
    
    if x_idempotency_key:
        _save_idempotency(db, x_idempotency_key, endpoint, 201, response)
    
    AuditService.log_action(
        db=db,
        action="ingest",
        resource_type="log_entry",
        new_value={"source_id": ingest_data.source_id, "count": count},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return response


@router.post("/search")
def search_logs(
    query: LogQuery,
    db: Session = Depends(get_db)
):
    db_query = db.query(LogEntry)
    
    if query.source_id:
        db_query = db_query.filter(LogEntry.source_id == query.source_id)
    if query.log_level:
        db_query = db_query.filter(LogEntry.log_level == query.log_level.value)
    if query.keyword:
        db_query = db_query.filter(LogEntry.message.contains(query.keyword))
    if query.start_time:
        db_query = db_query.filter(LogEntry.log_time >= query.start_time)
    if query.end_time:
        db_query = db_query.filter(LogEntry.log_time <= query.end_time)
    
    total = db_query.count()
    
    logs = db_query.order_by(LogEntry.log_time.desc())\
        .offset((query.page - 1) * query.page_size)\
        .limit(query.page_size)\
        .all()
    
    return {
        "total": total,
        "page": query.page,
        "page_size": query.page_size,
        "data": logs
    }


@router.get("/{log_id}", response_model=LogEntryResponse)
def get_log(
    log_id: int,
    db: Session = Depends(get_db)
):
    log = db.query(LogEntry).filter(LogEntry.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="日志不存在")
    return log


@router.delete("/{log_id}")
def delete_log(
    log_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    log = db.query(LogEntry).filter(LogEntry.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="日志不存在")
    
    db.delete(log)
    db.commit()
    
    AuditService.log_action(
        db=db,
        action="delete",
        resource_type="log_entry",
        resource_id=str(log_id),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {"message": "删除成功"}
