from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from typing import Optional
import json

from database import get_db, RestoreRecord, Approval, ExecutionStep, VerificationResult, ChangeLog, BackupPoint
import schemas
from state_machine import (
    RestoreState, transition_status, initialize_execution_steps,
    initialize_verification_items, get_available_actions, STATUS_DISPLAY
)

router = APIRouter()


@router.get("/records", response_model=schemas.PaginatedResponse)
def list_records(
    status: Optional[str] = None,
    applicant: Optional[str] = None,
    source_environment: Optional[str] = None,
    target_environment: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(RestoreRecord)
    
    if status:
        query = query.filter(RestoreRecord.status == status)
    if applicant:
        query = query.filter(RestoreRecord.applicant.contains(applicant))
    if source_environment:
        query = query.filter(RestoreRecord.source_environment == source_environment)
    if target_environment:
        query = query.filter(RestoreRecord.target_environment == target_environment)
    
    total = query.count()
    records = query.order_by(desc(RestoreRecord.created_at)).offset((page - 1) * page_size).limit(page_size).all()
    
    return {"total": total, "page": page, "page_size": page_size, "items": records}


@router.get("/records/{record_id}", response_model=schemas.RestoreRecordDetail)
def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(RestoreRecord).filter(RestoreRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@router.post("/records", response_model=schemas.RestoreRecord, status_code=201)
def create_record(record: schemas.RestoreRecordCreate, db: Session = Depends(get_db)):
    existing = db.query(RestoreRecord).filter(
        RestoreRecord.backup_point_id == record.backup_point_id,
        RestoreRecord.target_environment == record.target_environment,
        RestoreRecord.status.in_([
            RestoreState.PENDING_APPROVAL,
            RestoreState.APPROVED,
            RestoreState.DRILL_STARTED,
            RestoreState.DRILL_COMPLETED,
            RestoreState.EXECUTION_STARTED,
            RestoreState.EXECUTION_IN_PROGRESS
        ])
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"该备份点在目标环境已有进行中的恢复申请 (ID: {existing.id})"
        )
    
    db_record = RestoreRecord(**record.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    approval = Approval(
        record_id=db_record.id,
        approver="system_auto",
        approval_type="auto_check",
        status="approved",
        comment="系统自动检查通过"
    )
    db.add(approval)
    
    change_log = ChangeLog(
        record_id=db_record.id,
        action="create",
        changed_by=record.applicant,
        comment="创建恢复申请"
    )
    db.add(change_log)
    db.commit()
    
    return db_record


@router.put("/records/{record_id}", response_model=schemas.RestoreRecord)
def update_record(record_id: int, update: schemas.RestoreRecordUpdate, db: Session = Depends(get_db)):
    record = db.query(RestoreRecord).filter(RestoreRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    if record.status not in [RestoreState.PENDING_APPROVAL]:
        raise HTTPException(status_code=400, detail="当前状态不允许修改")
    
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    
    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return record


@router.post("/records/{record_id}/approve")
def approve_record(record_id: int, action: schemas.ApprovalAction, db: Session = Depends(get_db)):
    record = db.query(RestoreRecord).filter(RestoreRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    approval = Approval(
        record_id=record_id,
        approver=action.approver,
        approval_type="main",
        status="approved" if action.approved else "rejected",
        comment=action.comment,
        approved_at=datetime.utcnow()
    )
    db.add(approval)
    db.commit()
    
    new_status = RestoreState.APPROVED if action.approved else RestoreState.REJECTED
    success, message, updated_record = transition_status(
        db, record_id, new_status, action.approver, action.comment
    )
    
    if not success:
        db.rollback()
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": message, "record": updated_record}


@router.post("/records/{record_id}/start-drill")
def start_drill(record_id: int, execution: schemas.StepExecution, db: Session = Depends(get_db)):
    record = db.query(RestoreRecord).filter(RestoreRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    success, message, updated_record = transition_status(
        db, record_id, RestoreState.DRILL_STARTED, execution.operator, execution.comment
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    existing_steps = db.query(ExecutionStep).filter(ExecutionStep.record_id == record_id).count()
    if existing_steps == 0:
        initialize_execution_steps(db, record_id, is_drill=True)
    
    return {"success": True, "message": "演练已开始", "record": updated_record}


@router.post("/records/{record_id}/start-execution")
def start_execution(record_id: int, execution: schemas.StepExecution, db: Session = Depends(get_db)):
    record = db.query(RestoreRecord).filter(RestoreRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    success, message, updated_record = transition_status(
        db, record_id, RestoreState.EXECUTION_STARTED, execution.operator, execution.comment
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    existing_steps = db.query(ExecutionStep).filter(ExecutionStep.record_id == record_id).count()
    if existing_steps == 0:
        initialize_execution_steps(db, record_id, is_drill=False)
    
    success, message, updated_record = transition_status(
        db, record_id, RestoreState.EXECUTION_IN_PROGRESS, execution.operator
    )
    
    return {"success": True, "message": "执行已开始", "record": updated_record}


@router.post("/records/{record_id}/steps/{step_id}/complete")
def complete_step(
    record_id: int, step_id: int,
    result: str = None, error_message: str = None,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    step = db.query(ExecutionStep).filter(
        ExecutionStep.id == step_id,
        ExecutionStep.record_id == record_id
    ).first()
    
    if not step:
        raise HTTPException(status_code=404, detail="步骤不存在")
    
    step.status = "completed" if not error_message else "failed"
    step.completed_at = datetime.utcnow()
    step.result = result
    step.error_message = error_message
    
    if error_message:
        success, message, record = transition_status(
            db, record_id, RestoreState.EXECUTION_FAILED, operator, f"步骤{step.step_number}失败: {error_message}"
        )
        db.commit()
        return {"success": False, "message": "步骤执行失败", "step": step}
    
    db.commit()
    
    all_steps = db.query(ExecutionStep).filter(ExecutionStep.record_id == record_id).all()
    all_completed = all(s.status == "completed" for s in all_steps)
    
    if all_completed:
        initialize_verification_items(db, record_id)
        success, message, record = transition_status(
            db, record_id, RestoreState.VERIFICATION_PENDING, operator
        )
    
    return {"success": True, "message": "步骤完成", "step": step}


@router.post("/records/{record_id}/start-verification")
def start_verification(record_id: int, execution: schemas.StepExecution, db: Session = Depends(get_db)):
    success, message, record = transition_status(
        db, record_id, RestoreState.VERIFICATION_IN_PROGRESS, execution.operator, execution.comment
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": "验证已开始", "record": record}


@router.post("/records/{record_id}/verifications/{verification_id}/complete")
def complete_verification(
    record_id: int, verification_id: int,
    update: schemas.VerificationResultUpdate,
    db: Session = Depends(get_db)
):
    verification = db.query(VerificationResult).filter(
        VerificationResult.id == verification_id,
        VerificationResult.record_id == record_id
    ).first()
    
    if not verification:
        raise HTTPException(status_code=404, detail="验证项不存在")
    
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(verification, key, value)
    
    verification.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(verification)
    
    all_verifications = db.query(VerificationResult).filter(
        VerificationResult.record_id == record_id
    ).all()
    
    all_passed = all(v.passed for v in all_verifications if v.status == "completed")
    
    if all_passed and len([v for v in all_verifications if v.status == "completed"]) == len(all_verifications):
        success, message, record = transition_status(
            db, record_id, RestoreState.COMPLETED, update.verified_by or "system"
        )
    
    return {"success": True, "message": "验证完成", "verification": verification}


@router.post("/records/{record_id}/start-rollback")
def start_rollback(record_id: int, execution: schemas.StepExecution, db: Session = Depends(get_db)):
    success, message, record = transition_status(
        db, record_id, RestoreState.ROLLBACK_IN_PROGRESS, execution.operator, execution.comment
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": "回滚已开始", "record": record}


@router.post("/records/{record_id}/complete-drill")
def complete_drill(record_id: int, execution: schemas.StepExecution, db: Session = Depends(get_db)):
    steps = db.query(ExecutionStep).filter(ExecutionStep.record_id == record_id).all()
    for step in steps:
        if step.status == "pending":
            step.status = "completed"
            step.completed_at = datetime.utcnow()
            step.result = "演练自动完成"
    db.commit()
    
    success, message, record = transition_status(
        db, record_id, RestoreState.DRILL_COMPLETED, execution.operator, execution.comment
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": "演练已完成", "record": record}


@router.post("/records/{record_id}/complete-all-steps")
def complete_all_steps(record_id: int, execution: schemas.StepExecution, db: Session = Depends(get_db)):
    steps = db.query(ExecutionStep).filter(ExecutionStep.record_id == record_id).all()
    if not steps:
        initialize_execution_steps(db, record_id, is_drill=False)
        steps = db.query(ExecutionStep).filter(ExecutionStep.record_id == record_id).all()
    
    for step in steps:
        if step.status == "pending":
            step.status = "completed"
            step.completed_at = datetime.utcnow()
            step.result = f"步骤{step.step_number}自动完成"
    db.commit()
    
    existing_verifications = db.query(VerificationResult).filter(VerificationResult.record_id == record_id).count()
    if existing_verifications == 0:
        initialize_verification_items(db, record_id)
    
    success, message, record = transition_status(
        db, record_id, RestoreState.VERIFICATION_PENDING, execution.operator, execution.comment
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": "所有执行步骤已完成，进入待验证状态", "record": record}


@router.post("/records/{record_id}/complete-all-verifications")
def complete_all_verifications(record_id: int, execution: schemas.StepExecution, db: Session = Depends(get_db)):
    verifications = db.query(VerificationResult).filter(VerificationResult.record_id == record_id).all()
    if not verifications:
        initialize_verification_items(db, record_id)
        verifications = db.query(VerificationResult).filter(VerificationResult.record_id == record_id).all()
    
    for v in verifications:
        v.status = "completed"
        v.passed = True
        v.actual_value = "验证通过"
        v.verified_by = execution.operator
        v.verified_at = datetime.utcnow()
    db.commit()
    
    success, message, record = transition_status(
        db, record_id, RestoreState.COMPLETED, execution.operator, execution.comment
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": "所有验证项已通过，恢复完成", "record": record}


@router.post("/records/{record_id}/complete-rollback")
def complete_rollback(record_id: int, execution: schemas.StepExecution, db: Session = Depends(get_db)):
    success, message, record = transition_status(
        db, record_id, RestoreState.ROLLED_BACK, execution.operator, execution.comment
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": "回滚完成", "record": record}


@router.post("/records/{record_id}/retry-execution")
def retry_execution(record_id: int, execution: schemas.StepExecution, db: Session = Depends(get_db)):
    success, message, record = transition_status(
        db, record_id, RestoreState.EXECUTION_STARTED, execution.operator, execution.comment
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    steps = db.query(ExecutionStep).filter(ExecutionStep.record_id == record_id).all()
    for step in steps:
        step.status = "pending"
        step.result = None
        step.error_message = None
        step.started_at = None
        step.completed_at = None
    db.commit()
    
    success, message, record = transition_status(
        db, record_id, RestoreState.EXECUTION_IN_PROGRESS, execution.operator
    )
    
    return {"success": True, "message": "重试执行已开始", "record": record}


@router.get("/records/{record_id}/available-actions")
def get_record_actions(record_id: int, db: Session = Depends(get_db)):
    record = db.query(RestoreRecord).filter(RestoreRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    actions = get_available_actions(record.status)
    return {"status": record.status, "status_display": STATUS_DISPLAY.get(record.status, {}), "actions": actions}


@router.get("/records/{record_id}/export")
def export_record(record_id: int, format: str = "json", db: Session = Depends(get_db)):
    record = db.query(RestoreRecord).filter(RestoreRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    data = {
        "record": {
            "id": record.id,
            "title": record.title,
            "status": record.status,
            "applicant": record.applicant,
            "created_at": record.created_at.isoformat(),
            "backup_point": record.backup_point_id,
            "source_env": record.source_environment,
            "target_env": record.target_environment,
            "reason": record.reason
        },
        "approvals": [
            {
                "approver": a.approver,
                "type": a.approval_type,
                "status": a.status,
                "comment": a.comment,
                "time": a.approved_at.isoformat() if a.approved_at else None
            }
            for a in record.approvals
        ],
        "execution_steps": [
            {
                "number": s.step_number,
                "name": s.step_name,
                "status": s.status,
                "result": s.result,
                "error": s.error_message,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None
            }
            for s in record.execution_steps
        ],
        "verifications": [
            {
                "type": v.verification_type,
                "description": v.description,
                "status": v.status,
                "passed": v.passed,
                "expected": v.expected_value,
                "actual": v.actual_value,
                "verified_by": v.verified_by
            }
            for v in record.verification_results
        ],
        "change_logs": [
            {
                "action": c.action,
                "from": c.previous_status,
                "to": c.new_status,
                "operator": c.changed_by,
                "comment": c.comment,
                "time": c.changed_at.isoformat()
            }
            for c in record.change_logs
        ]
    }
    
    return data


@router.get("/backup-points", response_model=list[schemas.BackupPoint])
def list_backup_points(environment: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(BackupPoint).filter(BackupPoint.status == "available")
    if environment:
        query = query.filter(BackupPoint.environment == environment)
    return query.order_by(desc(BackupPoint.backup_time)).all()


@router.post("/backup-points", response_model=schemas.BackupPoint, status_code=201)
def create_backup_point(backup: schemas.BackupPointCreate, db: Session = Depends(get_db)):
    existing = db.query(BackupPoint).filter(BackupPoint.backup_id == backup.backup_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="备份点ID已存在")
    
    db_backup = BackupPoint(**backup.model_dump())
    db.add(db_backup)
    db.commit()
    db.refresh(db_backup)
    return db_backup


@router.get("/statistics")
def get_statistics(db: Session = Depends(get_db)):
    total = db.query(RestoreRecord).count()
    status_stats = {}
    for status in [
        RestoreState.PENDING_APPROVAL,
        RestoreState.APPROVED,
        RestoreState.DRILL_STARTED,
        RestoreState.EXECUTION_IN_PROGRESS,
        RestoreState.VERIFICATION_IN_PROGRESS,
        RestoreState.COMPLETED,
        RestoreState.EXECUTION_FAILED,
        RestoreState.ROLLED_BACK
    ]:
        count = db.query(RestoreRecord).filter(RestoreRecord.status == status).count()
        if count > 0:
            status_stats[status] = count
    
    return {
        "total": total,
        "by_status": status_stats,
        "status_display": STATUS_DISPLAY
    }
