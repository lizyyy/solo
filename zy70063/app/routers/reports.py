from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import date
from ..database import get_db
from ..schemas import ReportSummary, DailyReport
from ..services import ReportService

router = APIRouter(prefix="/reports", tags=["教务报表"])


@router.get("/summary", response_model=ReportSummary)
def get_summary(db: Session = Depends(get_db)):
    return ReportService.get_summary(db)


@router.get("/daily", response_model=DailyReport)
def get_daily_report(
    target_date: date = None,
    db: Session = Depends(get_db)
):
    if target_date is None:
        target_date = date.today()
    return DailyReport(**ReportService.get_daily_report(db, target_date))
