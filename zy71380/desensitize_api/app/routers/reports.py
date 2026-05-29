from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from app.models import ReportGenerateRequest, ReportResponse
from app.engine import report_generator

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/generate", response_model=ReportResponse)
def generate_report(body: ReportGenerateRequest):
    try:
        report = report_generator.generate_report(body.task_id, body.export_format)
        return report
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[ReportResponse])
def list_reports():
    return report_generator.list_reports()


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(report_id: int):
    report = report_generator.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    return report


@router.get("/{report_id}/export")
def export_report(report_id: int, format: str = Query(default="json", pattern=r"^(json|csv)$")):
    try:
        report = report_generator.get_report(report_id)
        if not report:
            raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
        if report["export_format"] != format:
            from app.database import get_connection
            import json
            conn = get_connection()
            try:
                conn.execute(
                    "UPDATE audit_reports SET export_format = ? WHERE id = ?",
                    (format, report_id),
                )
                conn.commit()
            finally:
                conn.close()
        content, media_type = report_generator.export_report(report_id)
        if format == "csv":
            return PlainTextResponse(content=content, media_type=media_type)
        return PlainTextResponse(content=content, media_type=media_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
