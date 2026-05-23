from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os

from ..database import get_db
from ..config import settings
from ..schemas import ExportRequest, DailySummary, SecuritySupervisorReport
from ..services import ReportService

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/security-supervisor/{batch_id}")
def get_security_supervisor_report(
    batch_id: int,
    generated_by: str = Query(...),
    db: Session = Depends(get_db),
):
    try:
        report = ReportService.generate_security_supervisor_report(
            db, batch_id, generated_by
        )
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/daily-summary", response_model=DailySummary)
def get_daily_summary(
    report_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    summary = ReportService.get_daily_summary(db, report_date)
    return summary


@router.post("/export")
def export_report(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
):
    try:
        filename = ReportService.export_to_excel(
            db,
            {
                "batch_ids": export_request.batch_ids,
                "start_date": export_request.start_date,
                "end_date": export_request.end_date,
                "include_state_history": export_request.include_state_history,
                "include_audit_logs": export_request.include_audit_logs,
                "exported_by": export_request.exported_by,
            },
        )
        return {
            "success": True,
            "filename": filename,
            "download_url": f"/api/reports/download/{filename}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{filename}")
def download_report(filename: str):
    file_path = os.path.join(settings.EXPORT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Report file not found")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
