from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, RoleEnum, WorkflowLog
from app.schemas import WorkflowAction, ConsumableRecordResponse, WorkflowLogResponse
from app.security import get_current_user, RoleChecker
from app.services import WorkflowService, AuditService

router = APIRouter(prefix="/workflow", tags=["工作流"])


@router.post("/records/{record_id}/submit", response_model=ConsumableRecordResponse)
def submit_record(
    record_id: int,
    action: WorkflowAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.ENTRY, RoleEnum.SUPERVISOR]))
):
    try:
        record = WorkflowService.submit_record(db, record_id, current_user, action.remarks)
        AuditService.log_action(db, current_user, "submit_record", "workflow", record_id)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/records/{record_id}/review", response_model=ConsumableRecordResponse)
def review_record(
    record_id: int,
    action: WorkflowAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.REVIEWER, RoleEnum.SUPERVISOR]))
):
    try:
        record = WorkflowService.review_record(db, record_id, current_user, action.action, action.remarks)
        AuditService.log_action(db, current_user, f"review_{action.action}", "workflow", record_id)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/records/{record_id}/second-confirm", response_model=ConsumableRecordResponse)
def second_confirm_record(
    record_id: int,
    action: WorkflowAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR]))
):
    try:
        record = WorkflowService.second_confirm(db, record_id, current_user, action.action, action.remarks)
        AuditService.log_action(db, current_user, f"second_confirm_{action.action}", "workflow", record_id)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/records/{record_id}/audit", response_model=ConsumableRecordResponse)
def audit_record(
    record_id: int,
    action: WorkflowAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR]))
):
    try:
        record = WorkflowService.audit_record(db, record_id, current_user, action.remarks)
        AuditService.log_action(db, current_user, "audit_record", "workflow", record_id)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/records/{record_id}/resubmit", response_model=ConsumableRecordResponse)
def resubmit_record(
    record_id: int,
    action: WorkflowAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.ENTRY, RoleEnum.SUPERVISOR]))
):
    try:
        record = WorkflowService.resubmit_record(db, record_id, current_user, action.remarks)
        AuditService.log_action(db, current_user, "resubmit_record", "workflow", record_id)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/records/{record_id}/logs", response_model=List[WorkflowLogResponse])
def get_workflow_logs(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == RoleEnum.ENTRY:
        record = db.query(ConsumableRecord).filter(ConsumableRecord.id == record_id).first()
        if record and record.created_by != current_user.id:
            raise HTTPException(status_code=403, detail="没有权限查看此记录的日志")

    logs = db.query(WorkflowLog).filter(WorkflowLog.record_id == record_id) \
        .order_by(WorkflowLog.created_at.desc()).all()
    return logs


@router.get("/my-tasks")
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models import ConsumableRecord, WorkflowStatus

    tasks = {
        "pending_review": [],
        "pending_second_confirm": [],
        "my_drafts": [],
        "rejected": []
    }

    if current_user.role in [RoleEnum.REVIEWER, RoleEnum.SUPERVISOR]:
        tasks["pending_review"] = db.query(ConsumableRecord).filter(
            ConsumableRecord.status == WorkflowStatus.SUBMITTED
        ).count()

    if current_user.role == RoleEnum.SUPERVISOR:
        tasks["pending_second_confirm"] = db.query(ConsumableRecord).filter(
            ConsumableRecord.status == WorkflowStatus.SECOND_CONFIRM
        ).count()

    tasks["my_drafts"] = db.query(ConsumableRecord).filter(
        ConsumableRecord.created_by == current_user.id,
        ConsumableRecord.status == WorkflowStatus.DRAFT
    ).count()

    tasks["rejected"] = db.query(ConsumableRecord).filter(
        ConsumableRecord.created_by == current_user.id,
        ConsumableRecord.status == WorkflowStatus.REJECTED
    ).count()

    return tasks

from app.models import ConsumableRecord
