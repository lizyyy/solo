from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import ReportGenerate, ReportResponse, ExceptionLogResponse, ExceptionLogResolve
from services import generate_report, log_exception
from models import InspectionReport, ExceptionLog
from datetime import datetime

router = APIRouter()


@router.post("/generate", response_model=ReportResponse)
def generate_inspection_report(report_data: ReportGenerate, db: Session = Depends(get_db)):
    try:
        return generate_report(db, report_data.serial_number, report_data.generated_by)
    except ValueError as e:
        log_exception(db, report_data.serial_number, "/reports/generate", report_data.model_dump(), str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{report_id}/export")
def export_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(InspectionReport).filter(InspectionReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    import json
    content = json.loads(report.content)
    return JSONResponse(content=content, media_type="application/json")


@router.get("/", response_model=List[ReportResponse])
def list_reports(serial_number: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(InspectionReport)
    if serial_number:
        from services import get_device_by_serial
        device = get_device_by_serial(db, serial_number)
        if device:
            query = query.filter(InspectionReport.device_id == device.id)
    return query.offset(skip).limit(limit).all()


@router.get("/exceptions/", response_model=List[ExceptionLogResponse])
def list_exceptions(resolved: bool = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(ExceptionLog)
    if resolved is not None:
        query = query.filter(ExceptionLog.resolved == resolved)
    return query.offset(skip).limit(limit).all()


@router.put("/exceptions/{exception_id}/resolve", response_model=ExceptionLogResponse)
def resolve_exception(exception_id: int, resolve_data: ExceptionLogResolve, db: Session = Depends(get_db)):
    exception_log = db.query(ExceptionLog).filter(ExceptionLog.id == exception_id).first()
    if not exception_log:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    
    exception_log.resolved = True
    exception_log.resolution = resolve_data.resolution
    exception_log.resolved_by = resolve_data.resolved_by
    exception_log.resolved_at = datetime.now()
    db.commit()
    db.refresh(exception_log)
    
    return exception_log
