from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_active_user, RoleChecker
from app.core.config import UserRole, RetryCategory
from app.models import User
from app.schemas import TaskSummaryReport, FailedRecordDetail
from app.services.report_service import ReportService

router = APIRouter()

@router.get("/summary", response_model=TaskSummaryReport)
def get_task_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    return service.get_task_summary()

@router.get("/failed-records", response_model=list[FailedRecordDetail])
def get_failed_records(
    skip: int = 0,
    limit: int = 100,
    category: RetryCategory = None,
    resolved: bool = None,
    current_user: User = Depends(RoleChecker([UserRole.REVIEWER, UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    records = service.get_failed_records(
        skip=skip, limit=limit,
        category=category.value if category else None,
        resolved=resolved
    )
    return records

@router.get("/retry-category-stats")
def get_retry_category_stats(
    current_user: User = Depends(RoleChecker([UserRole.REVIEWER, UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    return service.get_retry_category_stats()

@router.get("/data-sources-stability")
def get_data_sources_stability(
    current_user: User = Depends(RoleChecker([UserRole.REVIEWER, UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    return service.get_data_sources_stability()

@router.get("/top-errors")
def get_top_errors(
    limit: int = 10,
    current_user: User = Depends(RoleChecker([UserRole.REVIEWER, UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    return service.get_top_errors(limit=limit)

@router.get("/recent-activities")
def get_recent_activities(
    limit: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    return service.get_recent_activities(limit=limit)
