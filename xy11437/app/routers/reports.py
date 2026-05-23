from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from io import StringIO
from app.database import get_db
from app.auth import get_current_active_user, require_roles
from app import models, schemas, reports as report_service

router = APIRouter(prefix="/reports", tags=["报表"])


@router.get("/summary", response_model=schemas.ReportSummary)
async def get_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    return report_service.get_report_summary(db)


@router.get("/retry-categories", response_model=list[schemas.RetryCategoryStats])
async def get_retry_category_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    return report_service.get_retry_category_stats(db)


@router.get("/export")
async def export_records(
    status: Optional[models.RecordStatus] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    csv_content = report_service.export_records_to_csv(db, status)
    output = StringIO(csv_content)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cleaning_records_{status.value if status else 'all'}.csv"}
    )


@router.get("/export-failed")
async def export_failed_records(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.REVIEWER,
        models.UserRole.SUPERVISOR
    ))
):
    csv_content = report_service.export_failed_records_to_csv(db)
    output = StringIO(csv_content)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=failed_records.csv"}
    )


@router.get("/manager-dashboard", response_model=schemas.ManagerDashboard)
async def get_manager_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.SUPERVISOR
    ))
):
    return report_service.get_manager_dashboard(db)
