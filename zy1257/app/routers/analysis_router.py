from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from io import StringIO
from app.database import get_db
from app.schemas import RiskAnalysis, ComparisonResult, ReportExport
from app.services.analysis_service import AnalysisService, ReportService

router = APIRouter(prefix="/analysis", tags=["Analysis & Reports"])


@router.get("/risks/{task_id}", response_model=RiskAnalysis)
def get_task_risks(
    task_id: int,
    db: Session = Depends(get_db)
):
    try:
        service = AnalysisService(db)
        return service.analyze_task_risks(task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/compare", response_model=ComparisonResult)
def compare_tasks(
    task_ids: List[int] = Query(...),
    db: Session = Depends(get_db)
):
    if len(task_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 task IDs required for comparison")
    
    try:
        service = AnalysisService(db)
        return service.compare_tasks(task_ids)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/report/{task_id}/json")
def export_json_report(
    task_id: int,
    db: Session = Depends(get_db)
):
    try:
        service = ReportService(db)
        report = service.export_json_report(task_id)
        
        return StreamingResponse(
            StringIO(report.content),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={report.filename}"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/report/{task_id}/markdown")
def export_markdown_report(
    task_id: int,
    db: Session = Depends(get_db)
):
    try:
        service = ReportService(db)
        report = service.export_markdown_report(task_id)
        
        return StreamingResponse(
            StringIO(report.content),
            media_type="text/markdown",
            headers={
                "Content-Disposition": f"attachment; filename={report.filename}"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
