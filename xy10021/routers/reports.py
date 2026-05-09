from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
from database import get_db
from schemas import ReportRequest
from services.report_service import ReportService
from services.audit_service import AuditService
from datetime import datetime

router = APIRouter(prefix="/reports", tags=["报告"])


@router.post("/summary")
def get_summary(
    request: ReportRequest,
    db: Session = Depends(get_db)
):
    params = {
        "source_id": request.source_id,
        "log_level": request.log_level,
        "start_time": request.start_time,
        "end_time": request.end_time
    }
    
    summary = ReportService.generate_summary(db, params)
    return summary


@router.post("/export/excel")
def export_excel(
    request: ReportRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    params = {
        "source_id": request.source_id,
        "log_level": request.log_level,
        "start_time": request.start_time,
        "end_time": request.end_time
    }
    
    excel_data = ReportService.export_to_excel(db, params)
    
    AuditService.log_action(
        db=db,
        action="export",
        resource_type="report",
        new_value={
            "source_id": request.source_id,
            "log_level": request.log_level.value if request.log_level else None,
            "start_time": request.start_time.isoformat(),
            "end_time": request.end_time.isoformat(),
            "format": "excel"
        },
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent")
    )
    
    filename = f"log_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.post("/export/json")
def export_json(
    request: ReportRequest,
    http_request: Request,
    db: Session = Depends(get_db)
):
    from database import LogEntry
    import json
    
    query = db.query(LogEntry)
    
    if request.source_id:
        query = query.filter(LogEntry.source_id == request.source_id)
    if request.log_level:
        query = query.filter(LogEntry.log_level == request.log_level.value)
    if request.start_time:
        query = query.filter(LogEntry.log_time >= request.start_time)
    if request.end_time:
        query = query.filter(LogEntry.log_time <= request.end_time)
    
    logs = query.order_by(LogEntry.log_time.desc()).all()
    
    data = [
        {
            "id": log.id,
            "source_id": log.source_id,
            "log_time": log.log_time.isoformat() if log.log_time else None,
            "log_level": log.log_level,
            "module": log.module,
            "message": log.message,
            "trace_id": log.trace_id,
            "extra_data": log.extra_data
        }
        for log in logs
    ]
    
    json_str = json.dumps(data, ensure_ascii=False, indent=2)
    
    AuditService.log_action(
        db=db,
        action="export",
        resource_type="report",
        new_value={
            "source_id": request.source_id,
            "log_level": request.log_level.value if request.log_level else None,
            "start_time": request.start_time.isoformat(),
            "end_time": request.end_time.isoformat(),
            "format": "json",
            "count": len(data)
        },
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent")
    )
    
    filename = f"log_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    return StreamingResponse(
        BytesIO(json_str.encode('utf-8')),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
