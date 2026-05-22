from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models.enums import TaskStatus
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    return report_service.get_operation_dashboard(db)


@router.get("/retry-category-stats")
def get_retry_category_stats(db: Session = Depends(get_db)):
    return report_service.get_retry_category_stats(db)


@router.get("/dead-letter-stats")
def get_dead_letter_stats(db: Session = Depends(get_db)):
    return report_service.get_dead_letter_stats(db)


@router.get("/recovery-pending-stats")
def get_recovery_pending_stats(db: Session = Depends(get_db)):
    return report_service.get_recovery_pending_stats(db)


@router.get("/status-overview")
def get_status_overview(db: Session = Depends(get_db)):
    return report_service.get_status_overview(db)


@router.get("/export/tasks")
def export_tasks(
    status: TaskStatus = None,
    db: Session = Depends(get_db),
):
    excel_data = report_service.export_tasks_to_excel(db, status)
    filename = f"tasks_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        iter([excel_data.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/dead-letter")
def export_dead_letter(db: Session = Depends(get_db)):
    excel_data = report_service.export_dead_letter_to_excel(db)
    filename = f"dead_letter_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        iter([excel_data.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/retry-tasks")
def export_retry_tasks(db: Session = Depends(get_db)):
    excel_data = report_service.export_retry_tasks_to_excel(db)
    filename = f"retry_tasks_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        iter([excel_data.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
