from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
from datetime import datetime

from app.core.database import get_db
from app.models.models import (
    User,
    UserRole,
    ReceiptStatus,
    AbnormalReceipt
)
from app.schemas.schemas import (
    ExportRequest,
    BatchSummary
)
from app.utils.security import get_current_active_user, require_role
from app.services.report_service import ReportService
from app.services.automation_checker import AutomationChecker

router = APIRouter(prefix="/reports", tags=["报表导出"])


@router.post("/export/csv")
async def export_csv(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY, UserRole.AUDITOR]))
):
    if current_user.role == UserRole.COLLEGE_SECRETARY:
        export_request.college = current_user.college

    csv_data = ReportService.export_to_csv(db, export_request)

    filename = f"异常回执导出_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"

    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/export/excel")
async def export_excel(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY, UserRole.AUDITOR]))
):
    if current_user.role == UserRole.COLLEGE_SECRETARY:
        export_request.college = current_user.college

    excel_data = ReportService.export_to_excel(db, export_request)

    filename = f"异常回执导出_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/college-summary")
async def get_college_summary(
    college: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY, UserRole.AUDITOR]))
):
    if current_user.role == UserRole.COLLEGE_SECRETARY:
        college = current_user.college

    return ReportService.get_college_summary(db, college)


@router.get("/batch/{batch_id}/summary", response_model=BatchSummary)
async def get_batch_summary(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.models.models import Batch

    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and batch.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权访问其他学院的批次")

    summary = ReportService.get_batch_summary(db, batch_id)
    if not summary:
        raise HTTPException(status_code=404, detail="无法获取批次汇总")

    return summary


@router.get("/dashboard")
async def get_dashboard_data(
    college: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY]))
):
    if current_user.role == UserRole.COLLEGE_SECRETARY:
        college = current_user.college

    query = db.query(AbnormalReceipt)
    if college:
        query = query.filter(AbnormalReceipt.college == college)

    receipts = query.all()

    total_count = len(receipts)
    total_amount = sum(r.total_amount or 0 for r in receipts)

    by_status = {}
    by_type = {}
    for r in receipts:
        status_key = r.status.value
        by_status[status_key] = by_status.get(status_key, 0) + 1

        type_key = r.abnormal_type.value
        by_type[type_key] = by_type.get(type_key, 0) + 1

    return {
        "total_count": total_count,
        "total_amount": total_amount,
        "by_status": by_status,
        "by_abnormal_type": by_type,
        "college": college
    }


router_health = APIRouter(prefix="/checks", tags=["自动化检查"])


@router_health.get("/duplicate-imports")
async def check_duplicate_imports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.AUDITOR]))
):
    return AutomationChecker.check_duplicate_imports(db)


@router_health.get("/abnormal-preservation/{batch_id}")
async def check_abnormal_preservation(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.AUDITOR, UserRole.COLLEGE_SECRETARY]))
):
    return AutomationChecker.check_abnormal_preservation(db, batch_id)


@router_health.get("/history-consistency/{receipt_id}")
async def check_history_consistency(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.AUDITOR]))
):
    return AutomationChecker.check_history_consistency(db, receipt_id)


@router_health.get("/export-consistency/{batch_id}")
async def check_export_consistency(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.AUDITOR]))
):
    return AutomationChecker.check_export_consistency(db, batch_id)


@router_health.get("/all")
async def run_all_checks(
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.AUDITOR]))
):
    return AutomationChecker.run_all_checks(db, batch_id)
