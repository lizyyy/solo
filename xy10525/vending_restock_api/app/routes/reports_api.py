from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import date
import os
import tempfile

from app.database import get_db
from app.schemas.schemas import DailyReport
from app.services.report_service import ReportService
from app.utils.exceptions import BusinessException, handle_business_exception

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/daily", response_model=DailyReport)
def get_daily_report(
    report_date: date = Query(None),
    db: Session = Depends(get_db)
):
    if not report_date:
        report_date = date.today()
    
    service = ReportService(db)
    return service.generate_daily_report(report_date)


@router.get("/daily/export")
def export_daily_report(
    report_date: date = Query(None),
    db: Session = Depends(get_db)
):
    if not report_date:
        report_date = date.today()
    
    service = ReportService(db)
    report = service.generate_daily_report(report_date)
    
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        filepath = tmp.name
    
    service.export_report_excel(report, filepath)
    
    return FileResponse(
        path=filepath,
        filename=f"daily_restock_report_{report_date.strftime('%Y%m%d')}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
