from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import FinancialReport
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["财务报表"])

service = ReportService()


@router.get("/financial", response_model=FinancialReport)
def get_financial_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    return service.get_financial_report(db, start_date=start_date, end_date=end_date)
