from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily")
def get_daily_report(report_date: Optional[date] = None, db: Session = Depends(get_db)):
    service = ReportService(db)
    return service.generate_daily_report(report_date)


@router.get("/contract/{contract_id}")
def get_contract_detail_report(contract_id: int, db: Session = Depends(get_db)):
    service = ReportService(db)
    report = service.get_contract_detail_report(contract_id)
    if not report:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"合同 {contract_id} 不存在",
        )
    return report


@router.get("/validation")
def get_validation_report(db: Session = Depends(get_db)):
    service = ReportService(db)
    report = service.generate_daily_report()
    return report["validation"]
