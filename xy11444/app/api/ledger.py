from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from io import BytesIO
import pandas as pd

from app.database import get_db
from app.models import User
from app.schemas import (
    LossLedgerCreate,
    LossLedgerUpdate,
    LossLedgerResponse,
    LossLedgerSummary,
    LedgerListResponse,
    StatusChangeRequest,
    FailedRecordResponse,
)
from app.models.enums import LedgerStatus, UserRole
from app.services.auth_service import get_current_active_user, require_role
from app.services.ledger_service import (
    create_ledger,
    update_ledger_status,
    get_ledger_by_id,
    get_ledger_list,
    update_ledger,
    get_failed_records,
    get_ledger_versions,
)
from app.services.report_service import (
    get_role_view_report,
    get_desensitized_export_data,
    get_ledger_traceability,
    get_summary_statistics,
)

router = APIRouter(prefix="/ledger", tags=["台账管理"])


@router.post("", response_model=LossLedgerResponse)
async def create_new_ledger(
    ledger_data: LossLedgerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SORTER, UserRole.SUPERVISOR, UserRole.ADMIN]))
):
    return create_ledger(db, ledger_data, current_user.id)


@router.get("", response_model=LedgerListResponse)
async def list_ledgers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[LedgerStatus] = None,
    supplier_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    total, items = get_ledger_list(db, skip, limit, status, supplier_id)
    return {"total": total, "items": items}


@router.get("/{ledger_id}")
async def get_ledger_detail(
    ledger_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ledger = get_ledger_by_id(db, ledger_id, current_user)
    result = LossLedgerResponse.model_validate(ledger).model_dump()
    for history in result["status_histories"]:
        operator = db.query(User).filter(User.id == history["operator_id"]).first()
        if operator:
            history["operator_name"] = operator.full_name
    return result


@router.put("/{ledger_id}", response_model=LossLedgerResponse)
async def modify_ledger(
    ledger_id: int,
    update_data: LossLedgerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SORTER, UserRole.SUPERVISOR, UserRole.ADMIN]))
):
    return update_ledger(db, ledger_id, update_data, current_user.id)


@router.post("/{ledger_id}/submit", response_model=LossLedgerResponse)
async def submit_ledger(
    ledger_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SORTER, UserRole.SUPERVISOR, UserRole.ADMIN]))
):
    return update_ledger_status(db, ledger_id, LedgerStatus.SUBMITTED, request, current_user)


@router.post("/{ledger_id}/reject", response_model=LossLedgerResponse)
async def reject_ledger(
    ledger_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPERVISOR, UserRole.PROCUREMENT_MANAGER, UserRole.ADMIN]))
):
    return update_ledger_status(db, ledger_id, LedgerStatus.REJECTED, request, current_user)


@router.post("/{ledger_id}/secondary-confirm", response_model=LossLedgerResponse)
async def secondary_confirm_ledger(
    ledger_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SUPERVISOR, UserRole.PROCUREMENT_MANAGER, UserRole.ADMIN]))
):
    return update_ledger_status(db, ledger_id, LedgerStatus.SECONDARY_CONFIRMED, request, current_user)


@router.post("/{ledger_id}/audit-only", response_model=LossLedgerResponse)
async def set_audit_only(
    ledger_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.PROCUREMENT_MANAGER, UserRole.AUDITOR, UserRole.ADMIN]))
):
    return update_ledger_status(db, ledger_id, LedgerStatus.AUDIT_ONLY, request, current_user)


@router.get("/{ledger_id}/traceability")
async def get_traceability(
    ledger_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = get_ledger_traceability(db, ledger_id)
    if not result:
        raise HTTPException(status_code=404, detail="台账不存在")
    return result


@router.get("/{ledger_no}/versions", response_model=List[LossLedgerSummary])
async def list_ledger_versions(
    ledger_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return get_ledger_versions(db, ledger_no)


@router.get("/failed-records", response_model=List[FailedRecordResponse])
async def list_failed_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.AUDITOR, UserRole.ADMIN]))
):
    _, items = get_failed_records(db, skip, limit)
    return items


@router.get("/report/role-view")
async def role_view_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return get_role_view_report(db, current_user)


@router.get("/report/summary")
async def summary_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.PROCUREMENT_MANAGER, UserRole.AUDITOR, UserRole.ADMIN]))
):
    return get_summary_statistics(db)


@router.get("/export/desensitized")
async def export_desensitized(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.PROCUREMENT_MANAGER, UserRole.AUDITOR, UserRole.ADMIN]))
):
    data = get_desensitized_export_data(db, current_user)
    df_data = []
    for item in data:
        df_data.append({
            "台账编号": item.ledger_no,
            "供应商": item.supplier_name,
            "批次号": item.batch_no,
            "产品名称": item.product_name,
            "总重量(kg)": item.total_weight,
            "损耗重量(kg)": item.loss_weight,
            "损耗率(%)": item.loss_rate,
            "损耗类型": item.loss_type,
            "状态": item.status,
            "创建时间": item.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    df = pd.DataFrame(df_data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="脱敏导出")
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=loss_ledger_desensitized.xlsx"}
    )
