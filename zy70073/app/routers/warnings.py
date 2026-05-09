from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import WarningType, WarningLevel
from app.schemas.schemas import WarningRecordResponse, WarningReportSummary
from app.services.warning_service import WarningService

router = APIRouter(prefix="/warnings", tags=["warnings"])


@router.get("", response_model=List[WarningRecordResponse])
def list_warnings(
    contract_id: Optional[int] = None,
    warning_type: Optional[WarningType] = None,
    warning_level: Optional[WarningLevel] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    service = WarningService(db)
    if active_only:
        return service.get_active_warnings(contract_id, warning_type, warning_level)
    return service.get_active_warnings(contract_id, warning_type, warning_level)


@router.post("/run-checks")
def run_all_checks(reference_date: Optional[date] = None, db: Session = Depends(get_db)):
    service = WarningService(db)
    results = service.run_all_checks(reference_date)
    return results


@router.get("/summary", response_model=WarningReportSummary)
def get_warning_summary(db: Session = Depends(get_db)):
    service = WarningService(db)
    summary = service.get_warning_summary()
    return WarningReportSummary(**summary)


@router.post("/{warning_id}/resolve", response_model=WarningRecordResponse)
def resolve_warning(warning_id: int, db: Session = Depends(get_db)):
    service = WarningService(db)
    warning = service.resolve_warning(warning_id)
    if not warning:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"预警记录 {warning_id} 不存在",
        )
    return warning


@router.post("/contract/{contract_id}/resolve-by-entity")
def resolve_by_entity(
    contract_id: int,
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
):
    service = WarningService(db)
    count = service.resolve_by_entity(contract_id, entity_type, entity_id)
    return {"resolved_count": count}
