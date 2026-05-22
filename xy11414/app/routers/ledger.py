from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse
from io import BytesIO

from app.database import get_db
from app.auth import get_current_user, allow_data_entry, allow_all_authenticated, allow_reviewer, allow_supervisor
from app.models import User, RecordStatus
from app.schemas import (
    LedgerRecordCreate, LedgerRecordUpdate, LedgerRecordResponse,
    LedgerRecordDetailResponse, LedgerRecordListResponse,
    StatusChangeRequest, DirtyRecordResolveRequest, ExportRequest
)
from app.services import (
    create_ledger_record, update_ledger_record, change_record_status,
    detect_dirty_records, resolve_dirty_record, get_ledger_records,
    get_ledger_record_by_id
)
from app.permissions import (
    can_edit_record, can_change_status, apply_field_visibility,
    get_role_view_config, RoleViewConfig
)
from app.export_service import export_to_excel, export_history_to_excel

router = APIRouter(prefix="/ledger", tags=["台账记录"])


@router.post("", response_model=LedgerRecordResponse)
def create_record(
    record_data: LedgerRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_data_entry)
):
    db_record = create_ledger_record(db, record_data, current_user)
    detect_dirty_records(db, db_record)
    db.commit()
    db.refresh(db_record)

    result = LedgerRecordResponse.model_validate(db_record)
    result_dict = result.model_dump()
    filtered = apply_field_visibility(result_dict, db, current_user.role)
    return filtered


@router.get("", response_model=LedgerRecordListResponse)
def list_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    franchise_id: Optional[str] = None,
    status: Optional[RecordStatus] = None,
    is_dirty: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_all_authenticated)
):
    total, records = get_ledger_records(
        db, current_user, skip, limit, franchise_id, status, is_dirty
    )

    response_records = []
    for record in records:
        result = LedgerRecordResponse.model_validate(record)
        result_dict = result.model_dump()
        filtered = apply_field_visibility(result_dict, db, current_user.role)
        response_records.append(filtered)

    return {"total": total, "items": response_records}


@router.get("/{record_id}", response_model=LedgerRecordDetailResponse)
def get_record_detail(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_all_authenticated)
):
    db_record = get_ledger_record_by_id(db, record_id)
    if not db_record:
        raise HTTPException(status_code=404, detail="记录不存在")

    result = LedgerRecordDetailResponse.model_validate(db_record)
    result_dict = result.model_dump()
    filtered = apply_field_visibility(result_dict, db, current_user.role)
    return filtered


@router.put("/{record_id}", response_model=LedgerRecordResponse)
def update_record(
    record_id: int,
    update_data: LedgerRecordUpdate,
    change_reason: str = Query("", description="变更原因"),
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_data_entry)
):
    db_record = get_ledger_record_by_id(db, record_id)
    if not db_record:
        raise HTTPException(status_code=404, detail="记录不存在")

    if not can_edit_record(current_user, db_record.status):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="当前状态下无法编辑该记录"
        )

    db_record = update_ledger_record(db, db_record, update_data, current_user, change_reason)
    detect_dirty_records(db, db_record)
    db.commit()
    db.refresh(db_record)

    result = LedgerRecordResponse.model_validate(db_record)
    result_dict = result.model_dump()
    filtered = apply_field_visibility(result_dict, db, current_user.role)
    return filtered


@router.post("/{record_id}/submit")
def submit_record(
    record_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_data_entry)
):
    db_record = get_ledger_record_by_id(db, record_id)
    if not db_record:
        raise HTTPException(status_code=404, detail="记录不存在")

    if not can_change_status(current_user, db_record.status, RecordStatus.SUBMITTED):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限提交该记录"
        )

    db_record = change_record_status(
        db, db_record, RecordStatus.SUBMITTED, current_user,
        reason=request.reason or "提交审核"
    )
    db.commit()
    return {"message": "提交成功", "status": db_record.status.value}


@router.post("/{record_id}/reject")
def reject_record(
    record_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_reviewer)
):
    db_record = get_ledger_record_by_id(db, record_id)
    if not db_record:
        raise HTTPException(status_code=404, detail="记录不存在")

    if not can_change_status(current_user, db_record.status, RecordStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限驳回该记录"
        )

    db_record = change_record_status(
        db, db_record, RecordStatus.REJECTED, current_user,
        reason=request.reason or "驳回",
        rejection_reason=request.rejection_reason or ""
    )
    db.commit()
    return {"message": "驳回成功", "status": db_record.status.value}


@router.post("/{record_id}/confirm")
def confirm_record(
    record_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_supervisor)
):
    db_record = get_ledger_record_by_id(db, record_id)
    if not db_record:
        raise HTTPException(status_code=404, detail="记录不存在")

    if not can_change_status(current_user, db_record.status, RecordStatus.CONFIRMED):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限确认该记录"
        )

    db_record = change_record_status(
        db, db_record, RecordStatus.CONFIRMED, current_user,
        reason=request.reason or "主管确认"
    )
    db.commit()
    return {"message": "确认成功", "status": db_record.status.value}


@router.post("/{record_id}/audit-only")
def set_audit_only(
    record_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_supervisor)
):
    db_record = get_ledger_record_by_id(db, record_id)
    if not db_record:
        raise HTTPException(status_code=404, detail="记录不存在")

    if not can_change_status(current_user, db_record.status, RecordStatus.AUDIT_ONLY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限设置该记录为只读审计状态"
        )

    db_record = change_record_status(
        db, db_record, RecordStatus.AUDIT_ONLY, current_user,
        reason=request.reason or "设置为只读审计"
    )
    db.commit()
    return {"message": "设置成功", "status": db_record.status.value}


@router.post("/dirty/{dirty_record_id}/resolve")
def resolve_dirty(
    dirty_record_id: int,
    request: DirtyRecordResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_reviewer)
):
    dr = resolve_dirty_record(db, dirty_record_id, current_user, request.resolution_notes)
    if not dr:
        raise HTTPException(status_code=404, detail="脏记录不存在")
    db.commit()
    return {"message": "解决成功", "dirty_record_id": dirty_record_id}


@router.post("/export")
def export_records(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_all_authenticated)
):
    excel_file = export_to_excel(
        db, current_user,
        record_ids=export_request.record_ids,
        start_date=export_request.start_date,
        end_date=export_request.end_date,
        franchise_id=export_request.franchise_id,
        masked=export_request.masked
    )

    return StreamingResponse(
        BytesIO(excel_file.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=ledger_records.xlsx"}
    )


@router.get("/{record_id}/export-history")
def export_record_history(
    record_id: int,
    masked: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_all_authenticated)
):
    excel_file = export_history_to_excel(db, record_id, current_user, masked)

    return StreamingResponse(
        BytesIO(excel_file.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=record_{record_id}_history.xlsx"}
    )


@router.get("/role-config/view", response_model=RoleViewConfig)
def get_my_view_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_all_authenticated)
):
    return get_role_view_config(db, current_user.role)
