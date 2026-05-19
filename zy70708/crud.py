from sqlalchemy.orm import Session
from typing import List, Optional
import json

from models import DNSPreviewTask, DNSRecordDiff, TaskOperationLog
from schemas import (
    DNSPreviewTaskCreate, DNSPreviewTaskUpdate,
    DNSRecordDiffCreate, TaskOperationLogCreate,
    ManualCorrection
)
from core_logic import TTLRiskEvaluator, RecordDiffCalculator


def create_task(db: Session, task: DNSPreviewTaskCreate) -> DNSPreviewTask:
    assessments, overall_risk = TTLRiskEvaluator.evaluate_batch(task.records)

    db_task = DNSPreviewTask(
        domain=task.domain,
        record_type=task.record_type,
        old_target=task.old_target,
        new_target=task.new_target,
        ttl_strategy=task.ttl_strategy,
        created_by=task.created_by,
        risk_level=overall_risk,
        status="draft"
    )
    db.add(db_task)
    db.flush()

    risk_reasons = []
    for i, record in enumerate(task.records):
        assessment = assessments[i]
        diff_status = RecordDiffCalculator.calculate_diff(record.old_value, record.new_value)
        
        db_record = DNSRecordDiff(
            task_id=db_task.id,
            record_name=record.record_name,
            record_type=record.record_type,
            old_value=record.old_value,
            new_value=record.new_value,
            old_ttl=record.old_ttl,
            new_ttl=record.new_ttl,
            diff_status=diff_status,
            ttl_risk=assessment.is_risky,
            ttl_risk_reason=assessment.risk_reason
        )
        db.add(db_record)
        
        if assessment.is_risky:
            risk_reasons.append(f"{record.record_name}: {assessment.risk_reason}")

    if risk_reasons:
        db_task.risk_reason = "; ".join(risk_reasons)

    log_operation(
        db, db_task.id, "create", task.created_by,
        original_input=json.dumps(task.model_dump(), ensure_ascii=False),
        conclusion=f"任务创建成功，风险等级: {overall_risk}"
    )

    db.commit()
    db.refresh(db_task)
    return db_task


def get_task(db: Session, task_id: int) -> Optional[DNSPreviewTask]:
    return db.query(DNSPreviewTask).filter(
        DNSPreviewTask.id == task_id,
        DNSPreviewTask.is_deleted == False
    ).first()


def get_tasks(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None, domain: Optional[str] = None) -> List[DNSPreviewTask]:
    query = db.query(DNSPreviewTask).filter(DNSPreviewTask.is_deleted == False)
    if status:
        query = query.filter(DNSPreviewTask.status == status)
    if domain:
        query = query.filter(DNSPreviewTask.domain.contains(domain))
    return query.offset(skip).limit(limit).all()


def update_task_status(db: Session, task_id: int, target_status: str, operator: str, remark: Optional[str] = None) -> Optional[DNSPreviewTask]:
    task = get_task(db, task_id)
    if not task:
        return None

    old_status = task.status
    task.status = target_status
    
    if target_status == "executing":
        task.rollback_target = task.old_target

    db.add(task)

    log_operation(
        db, task_id, f"status_change:{old_status}->{target_status}",
        operator, remark=remark, conclusion=f"状态从 {old_status} 变更为 {target_status}"
    )

    db.commit()
    db.refresh(task)
    return task


def manual_correct_task(db: Session, task_id: int, correction: ManualCorrection) -> Optional[DNSPreviewTask]:
    task = get_task(db, task_id)
    if not task:
        return None

    changes = []

    if correction.old_target is not None:
        task.old_target = correction.old_target
        changes.append("old_target")

    if correction.new_target is not None:
        task.new_target = correction.new_target
        changes.append("new_target")

    if correction.ttl_strategy is not None:
        task.ttl_strategy = correction.ttl_strategy
        changes.append("ttl_strategy")

    if correction.records is not None:
        db.query(DNSRecordDiff).filter(DNSRecordDiff.task_id == task_id).delete()
        
        assessments, overall_risk = TTLRiskEvaluator.evaluate_batch(correction.records)
        
        risk_reasons = []
        for i, record in enumerate(correction.records):
            assessment = assessments[i]
            diff_status = RecordDiffCalculator.calculate_diff(record.old_value, record.new_value)
            
            db_record = DNSRecordDiff(
                task_id=task_id,
                record_name=record.record_name,
                record_type=record.record_type,
                old_value=record.old_value,
                new_value=record.new_value,
                old_ttl=record.old_ttl,
                new_ttl=record.new_ttl,
                diff_status=diff_status,
                ttl_risk=assessment.is_risky,
                ttl_risk_reason=assessment.risk_reason
            )
            db.add(db_record)
            
            if assessment.is_risky:
                risk_reasons.append(f"{record.record_name}: {assessment.risk_reason}")

        task.risk_level = overall_risk
        task.risk_reason = "; ".join(risk_reasons) if risk_reasons else None
        changes.append("records")

    db.add(task)

    log_operation(
        db, task_id, "manual_correction",
        correction.operator,
        original_input=json.dumps(correction.model_dump(), ensure_ascii=False),
        conclusion=f"人工修正完成，变更字段: {', '.join(changes)}",
        remark=correction.remark
    )

    db.commit()
    db.refresh(task)
    return task


def close_task(db: Session, task_id: int, operator: str, reason: str, conclusion: Optional[str] = None) -> Optional[DNSPreviewTask]:
    task = get_task(db, task_id)
    if not task:
        return None

    task.status = "closed"
    task.is_deleted = True
    db.add(task)

    log_operation(
        db, task_id, "close", operator,
        conclusion=conclusion or reason,
        remark=reason
    )

    db.commit()
    db.refresh(task)
    return task


def rollback_task(db: Session, task_id: int, operator: str) -> Optional[DNSPreviewTask]:
    task = get_task(db, task_id)
    if not task:
        return None

    task.status = "rollback"
    
    db.add(task)

    log_operation(
        db, task_id, "rollback", operator,
        conclusion=f"执行回滚，回滚目标: {task.rollback_target}"
    )

    db.commit()
    db.refresh(task)
    return task


def log_operation(db: Session, task_id: int, operation: str, operator: str, 
                  original_input: Optional[str] = None, conclusion: Optional[str] = None,
                  remark: Optional[str] = None) -> TaskOperationLog:
    log = TaskOperationLog(
        task_id=task_id,
        operation=operation,
        operator=operator,
        original_input=original_input,
        conclusion=conclusion,
        remark=remark
    )
    db.add(log)
    return log


def get_task_logs(db: Session, task_id: int) -> List[TaskOperationLog]:
    return db.query(TaskOperationLog).filter(TaskOperationLog.task_id == task_id).order_by(TaskOperationLog.created_at.desc()).all()
