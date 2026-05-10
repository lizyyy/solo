from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.schemas.schemas import (
    InspectionReportCreate, InspectionReportResponse, ReportListResponse,
    ExceptionRecordResponse, ExceptionListResponse,
    PendingTaskResponse, TaskListResponse,
    BackgroundJobResponse, JobListResponse,
    AntiCounterfeitingReport
)
from app.services import (
    create_inspection_report, get_reports,
    scan_code, get_scan_logs,
    get_exceptions, resolve_exception,
    get_pending_tasks, complete_task,
    get_background_jobs, get_anticounterfeiting_report
)

router = APIRouter(tags=["查询与管理"])


@router.post("/api/reports", response_model=InspectionReportResponse)
def api_create_report(
    data: InspectionReportCreate,
    db: Session = Depends(get_db)
):
    return create_inspection_report(db, data)


@router.get("/api/reports", response_model=ReportListResponse)
def api_list_reports(
    skip: int = 0,
    limit: int = 100,
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    reports, total = get_reports(db, skip, limit, batch_id)
    return {"reports": reports, "total": total}


@router.get("/api/scan/{code}")
def api_scan_code(
    code: str,
    request: Request,
    db: Session = Depends(get_db)
):
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    result = scan_code(db, code, client_ip, user_agent)
    return result


@router.get("/api/scan-logs")
def api_list_scan_logs(
    skip: int = 0,
    limit: int = 100,
    code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    logs, total = get_scan_logs(db, skip, limit, code)
    return {
        "logs": [
            {
                "id": l.id,
                "code_id": l.code_id,
                "code_value": l.code_value,
                "scan_result": l.scan_result,
                "scanned_at": l.scanned_at
            }
            for l in logs
        ],
        "total": total
    }


@router.get("/api/exceptions", response_model=ExceptionListResponse)
def api_list_exceptions(
    skip: int = 0,
    limit: int = 100,
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    records, total = get_exceptions(db, skip, limit, resolved)
    return {"records": records, "total": total}


@router.post("/api/exceptions/{exception_id}/resolve", response_model=ExceptionRecordResponse)
def api_resolve_exception(
    exception_id: int,
    resolved_by: str,
    db: Session = Depends(get_db)
):
    record = resolve_exception(db, exception_id, resolved_by)
    if not record:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Exception record not found")
    return record


@router.get("/api/pending-tasks", response_model=TaskListResponse)
def api_list_pending_tasks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    tasks, total = get_pending_tasks(db, skip, limit)
    return {"tasks": tasks, "total": total}


@router.post("/api/pending-tasks/{task_id}/complete", response_model=PendingTaskResponse)
def api_complete_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    task = complete_task(db, task_id)
    if not task:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/api/background-jobs", response_model=JobListResponse)
def api_list_background_jobs(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    jobs, total = get_background_jobs(db, skip, limit, status)
    return {"jobs": jobs, "total": total}


@router.get("/api/reports/anticounterfeiting", response_model=AntiCounterfeitingReport)
def api_get_anticounterfeiting_report(
    db: Session = Depends(get_db)
):
    return get_anticounterfeiting_report(db)
