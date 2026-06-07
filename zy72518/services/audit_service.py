from sqlalchemy.orm import Session
from models import AuditLog, TodoExtract, ManualJudgment
from datetime import datetime
from typing import List, Dict, Any, Optional


def log_audit(
    db: Session,
    todo_id: int,
    action: str,
    actor: str,
    old_value: Dict[str, Any],
    new_value: Dict[str, Any],
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> AuditLog:
    changed_fields = []
    for key in set(list(old_value.keys()) + list(new_value.keys())):
        if old_value.get(key) != new_value.get(key):
            changed_fields.append(key)

    audit_log = AuditLog(
        todo_id=todo_id,
        action=action,
        actor=actor,
        old_value=old_value,
        new_value=new_value,
        changed_fields=changed_fields,
        reason=reason,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    return audit_log


def get_todo_audit_logs(db: Session, todo_id: int) -> List[AuditLog]:
    return db.query(AuditLog).filter(
        AuditLog.todo_id == todo_id
    ).order_by(AuditLog.created_at.desc()).all()


def get_actor_audit_logs(db: Session, actor: str) -> List[AuditLog]:
    return db.query(AuditLog).filter(
        AuditLog.actor == actor
    ).order_by(AuditLog.created_at.desc()).limit(100).all()


def create_manual_judgment(
    db: Session,
    todo_id: int,
    judge_by: str,
    changes: Dict[str, Any],
    reason: str
) -> tuple[TodoExtract, ManualJudgment]:
    todo = db.query(TodoExtract).filter(TodoExtract.id == todo_id).first()
    if not todo:
        raise ValueError(f"Todo {todo_id} not found")

    old_value = {
        "desensitization_level": todo.desensitization_level,
        "desensitization_note": todo.desensitization_note,
        "status": todo.status,
        "priority": todo.priority
    }

    original_value = old_value.copy()
    new_value = old_value.copy()
    new_value.update(changes)

    judgment = ManualJudgment(
        todo_id=todo_id,
        judge_by=judge_by,
        judge_at=datetime.utcnow(),
        original_value=original_value,
        new_value=new_value,
        changed_fields=list(changes.keys()),
        reason=reason,
        is_overridden=False,
        impact_analysis=_calculate_impact(todo, changes)
    )

    for key, value in changes.items():
        setattr(todo, key, value)

    todo.is_manual_judgment = True
    todo.manual_judgment_by = judge_by
    todo.manual_judgment_at = datetime.utcnow()
    todo.manual_judgment_reason = reason

    db.add(judgment)
    db.commit()

    log_audit(
        db=db,
        todo_id=todo_id,
        action="manual_judgment",
        actor=judge_by,
        old_value=old_value,
        new_value=new_value,
        reason=reason
    )

    return todo, judgment


def _calculate_impact(todo: TodoExtract, changes: Dict[str, Any]) -> Dict[str, Any]:
    impact = {
        "affected_fields": list(changes.keys()),
        "security_impact": False,
        "desensitization_change": False,
        "downstream_impact": []
    }

    if "desensitization_level" in changes:
        impact["desensitization_change"] = True
        impact["security_impact"] = True
        impact["downstream_impact"].append("导出数据脱敏级别变更")
        impact["downstream_impact"].append("评测报告准确率计算影响")

    if "status" in changes:
        impact["downstream_impact"].append("待办状态跟踪变更")

    return impact


def mark_judgment_overridden(
    db: Session,
    todo_id: int,
    batch_id: int,
    new_values: Dict[str, Any]
) -> None:
    todo = db.query(TodoExtract).filter(TodoExtract.id == todo_id).first()
    if not todo:
        return

    latest_judgment = db.query(ManualJudgment).filter(
        ManualJudgment.todo_id == todo_id,
        ManualJudgment.is_overridden == False
    ).order_by(ManualJudgment.judge_at.desc()).first()

    if latest_judgment:
        latest_judgment.is_overridden = True
        latest_judgment.overridden_by_batch_id = batch_id

        old_value = {
            "desensitization_level": todo.desensitization_level,
            "status": todo.status
        }

        todo.is_overridden_by_batch = True
        todo.overridden_by_batch_id = batch_id
        todo.needs_security_review = True
        todo.security_review_status = "pending"

        for key, value in new_values.items():
            setattr(todo, key, value)

        log_audit(
            db=db,
            todo_id=todo_id,
            action="batch_override_manual_judgment",
            actor=f"batch_{batch_id}",
            old_value=old_value,
            new_value=new_values,
            reason=f"灰度批次{batch_id}重新批跑，覆盖人工改判结果，需安全审核复核"
        )

    db.commit()


def get_review_traces(db: Session, todo_id: int) -> Dict[str, Any]:
    todo = db.query(TodoExtract).filter(TodoExtract.id == todo_id).first()
    if not todo:
        return {}

    judgments = db.query(ManualJudgment).filter(
        ManualJudgment.todo_id == todo_id
    ).order_by(ManualJudgment.judge_at.desc()).all()

    audit_logs = get_todo_audit_logs(db, todo_id)

    return {
        "todo_id": todo_id,
        "current_status": todo.status,
        "current_desensitization_level": todo.desensitization_level,
        "is_manual_judgment": todo.is_manual_judgment,
        "is_overridden_by_batch": todo.is_overridden_by_batch,
        "needs_security_review": todo.needs_security_review,
        "security_review_status": todo.security_review_status,
        "manual_judgments": [
            {
                "id": j.id,
                "judge_by": j.judge_by,
                "judge_at": j.judge_at.isoformat(),
                "original_value": j.original_value,
                "new_value": j.new_value,
                "changed_fields": j.changed_fields,
                "reason": j.reason,
                "is_overridden": j.is_overridden,
                "overridden_by_batch_id": j.overridden_by_batch_id,
                "impact_analysis": j.impact_analysis
            }
            for j in judgments
        ],
        "audit_logs": [
            {
                "id": a.id,
                "action": a.action,
                "actor": a.actor,
                "changed_fields": a.changed_fields,
                "old_value": a.old_value,
                "new_value": a.new_value,
                "reason": a.reason,
                "created_at": a.created_at.isoformat()
            }
            for a in audit_logs
        ]
    }
