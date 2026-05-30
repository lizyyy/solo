from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from database import get_db
from services.report_generator import generate_weekly_report, export_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/weekly")
def create_weekly_report(
    student_id: int = Query(...),
    week_start: datetime = Query(...),
    week_end: datetime = Query(...),
    db: Session = Depends(get_db),
):
    return generate_weekly_report(db, student_id, week_start, week_end)


@router.get("/weekly")
def get_weekly_report(
    student_id: int = Query(...),
    week_start: datetime = Query(...),
    week_end: datetime = Query(...),
    db: Session = Depends(get_db),
):
    return generate_weekly_report(db, student_id, week_start, week_end)


@router.get("/progress")
def get_progress_interpretation(
    student_id: int = Query(...),
    current_week_start: datetime = Query(...),
    current_week_end: datetime = Query(...),
    prev_week_start: Optional[datetime] = None,
    prev_week_end: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    from services.progress_interpreter import interpret_progress

    return interpret_progress(
        db,
        student_id,
        current_week_start,
        current_week_end,
        prev_week_start,
        prev_week_end,
    )


@router.get("/export")
def export_weekly_report(
    student_id: int = Query(...),
    week_start: datetime = Query(...),
    week_end: datetime = Query(...),
    format: str = Query("json", pattern="^(json|csv)$"),
    db: Session = Depends(get_db),
):
    result = export_report(db, student_id, week_start, week_end, format)
    if format == "csv":
        return PlainTextResponse(content=result["data"], media_type="text/csv")
    return result
