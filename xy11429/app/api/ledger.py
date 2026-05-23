from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, VisitorLedger, LedgerStatus, DataSource
from ..schemas import (
    VisitorLedgerResponse, VisitorLedgerDetailResponse, VisitorLedgerCreate,
    WorkflowActionRequest, WorkflowLogResponse, VersionHistoryResponse,
    ImportBatchResponse, SupplementRecordCreate, SupplementRecordResponse,
    ManualJudgmentRequest
)
from ..services.auth_service import get_current_active_user
from ..services.workflow_service import WorkflowService
from ..services.import_service import ImportService

router = APIRouter(prefix="/ledger", tags=["台账管理"])


@router.get("", response_model=List[VisitorLedgerResponse])
async def list_ledgers(
    status: Optional[LedgerStatus] = None,
    is_cross_day: Optional[bool] = None,
    is_manual_judgment: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(VisitorLedger)

    if status:
        query = query.filter(VisitorLedger.status == status)
    if is_cross_day is not None:
        query = query.filter(VisitorLedger.is_cross_day == is_cross_day)
    if is_manual_judgment is not None:
        query = query.filter(VisitorLedger.is_manual_judgment == is_manual_judgment)

    ledgers = query.order_by(VisitorLedger.created_at.desc()).offset(skip).limit(limit).all()
    return ledgers


@router.get("/{ledger_id}", response_model=VisitorLedgerDetailResponse)
async def get_ledger(
    ledger_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ledger = db.query(VisitorLedger).filter(VisitorLedger.id == ledger_id).first()
    if not ledger:
        raise HTTPException(status_code=404, detail="台账不存在")
    return ledger


@router.post("", response_model=VisitorLedgerResponse)
async def create_ledger(
    ledger_data: VisitorLedgerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import uuid
    from datetime import datetime

    ledger_no = f"VL-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

    ledger = VisitorLedger(
        ledger_no=ledger_no,
        **ledger_data.model_dump(),
        created_by=current_user.id
    )

    grant_time = ledger.permission_granted_time
    revoke_time = ledger.permission_revoked_time
    appointment_end = ledger.appointment_end_time
    is_cross_day = False
    if grant_time and revoke_time:
        is_cross_day = grant_time.date() != revoke_time.date()
    elif grant_time and appointment_end:
        is_cross_day = grant_time.date() != appointment_end.date()
    ledger.is_cross_day = is_cross_day

    db.add(ledger)
    db.commit()
    db.refresh(ledger)
    return ledger


@router.put("/{ledger_id}", response_model=VisitorLedgerResponse)
async def update_ledger(
    ledger_id: int,
    update_data: VisitorLedgerCreate,
    change_reason: Optional[str] = Query(None, description="变更原因"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.edit_draft(
            ledger_id, current_user, update_data.model_dump(), change_reason
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ledger_id}/submit", response_model=VisitorLedgerResponse)
async def submit_ledger(
    ledger_id: int,
    action_data: WorkflowActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.submit(
            ledger_id, current_user, action_data.comment, action_data.change_reason
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ledger_id}/reject", response_model=VisitorLedgerResponse)
async def reject_ledger(
    ledger_id: int,
    action_data: WorkflowActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.reject(
            ledger_id, current_user, action_data.comment, action_data.change_reason
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ledger_id}/second-confirm", response_model=VisitorLedgerResponse)
async def second_confirm_ledger(
    ledger_id: int,
    action_data: WorkflowActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.second_confirmation(
            ledger_id, current_user, action_data.comment, action_data.change_reason
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ledger_id}/confirm", response_model=VisitorLedgerResponse)
async def confirm_ledger(
    ledger_id: int,
    action_data: WorkflowActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.confirm(
            ledger_id, current_user, action_data.comment, action_data.change_reason
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ledger_id}/withdraw", response_model=VisitorLedgerResponse)
async def withdraw_ledger(
    ledger_id: int,
    action_data: WorkflowActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.withdraw(
            ledger_id, current_user, action_data.comment, action_data.change_reason
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ledger_id}/freeze", response_model=VisitorLedgerResponse)
async def freeze_ledger(
    ledger_id: int,
    action_data: WorkflowActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.freeze(
            ledger_id, current_user, action_data.comment, action_data.change_reason
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ledger_id}/unfreeze", response_model=VisitorLedgerResponse)
async def unfreeze_ledger(
    ledger_id: int,
    action_data: WorkflowActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.unfreeze(
            ledger_id, current_user, action_data.comment, action_data.change_reason
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ledger_id}/manual-judgment", response_model=VisitorLedgerResponse)
async def manual_judgment(
    ledger_id: int,
    judgment_data: ManualJudgmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.manual_judgment(
            ledger_id, current_user,
            judgment_data.permission_result,
            judgment_data.judgment_reason
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{ledger_id}/workflow-logs", response_model=List[WorkflowLogResponse])
async def get_workflow_logs(
    ledger_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    return workflow_service.get_workflow_logs(ledger_id)


@router.get("/{ledger_id}/version-history", response_model=List[VersionHistoryResponse])
async def get_version_history(
    ledger_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    return workflow_service.get_version_history(ledger_id)


@router.get("/{ledger_id}/compare-versions")
async def compare_versions(
    ledger_id: int,
    version1: int = Query(..., description="版本1"),
    version2: int = Query(..., description="版本2"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.compare_versions(ledger_id, version1, version2)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{ledger_id}/supplements", response_model=SupplementRecordResponse)
async def add_supplement(
    ledger_id: int,
    supplement_data: SupplementRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    workflow_service = WorkflowService(db)
    try:
        return workflow_service.add_supplement(
            ledger_id, current_user,
            supplement_data.supplement_type,
            supplement_data.content,
            supplement_data.remark
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import/{source_type}", response_model=ImportBatchResponse)
async def import_data(
    source_type: DataSource,
    file: UploadFile = File(...),
    skip_duplicates: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import_service = ImportService(db)
    try:
        content = await file.read()
        batch = import_service.import_from_excel(
            content, file.filename or "unknown.xlsx",
            source_type, current_user, skip_duplicates
        )
        return batch
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")
