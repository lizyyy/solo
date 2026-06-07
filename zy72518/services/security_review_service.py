from sqlalchemy.orm import Session
from models import TodoExtract, AuditLog
from services.audit_service import log_audit
from datetime import datetime
from typing import List, Dict, Any, Optional


def get_pending_security_reviews(db: Session, batch_id: Optional[int] = None) -> List[TodoExtract]:
    query = db.query(TodoExtract).filter(
        TodoExtract.needs_security_review == True,
        TodoExtract.security_review_status == "pending"
    )
    if batch_id:
        query = query.filter(TodoExtract.gray_batch_id == batch_id)
    return query.order_by(TodoExtract.updated_at.desc()).all()


def review_security_item(
    db: Session,
    todo_id: int,
    reviewer: str,
    review_status: str,
    review_note: str = ""
) -> TodoExtract:
    todo = db.query(TodoExtract).filter(TodoExtract.id == todo_id).first()
    if not todo:
        raise ValueError(f"Todo {todo_id} not found")

    if not todo.needs_security_review:
        raise ValueError(f"Todo {todo_id} does not need security review")

    old_value = {
        "security_review_status": todo.security_review_status,
        "needs_security_review": todo.needs_security_review
    }

    todo.security_review_status = review_status
    todo.security_review_by = reviewer
    todo.security_review_at = datetime.utcnow()
    todo.security_review_note = review_note

    if review_status == "approved":
        todo.needs_security_review = False
        action = "security_review_approved"
    elif review_status == "rejected":
        action = "security_review_rejected"
    else:
        action = "security_review_updated"

    new_value = {
        "security_review_status": review_status,
        "needs_security_review": todo.needs_security_review
    }

    log_audit(
        db=db,
        todo_id=todo_id,
        action=action,
        actor=reviewer,
        old_value=old_value,
        new_value=new_value,
        reason=review_note
    )

    db.commit()
    return todo


def get_security_review_statistics(db: Session) -> Dict[str, Any]:
    total_pending = db.query(TodoExtract).filter(
        TodoExtract.needs_security_review == True,
        TodoExtract.security_review_status == "pending"
    ).count()

    total_approved = db.query(TodoExtract).filter(
        TodoExtract.security_review_status == "approved"
    ).count()

    total_rejected = db.query(TodoExtract).filter(
        TodoExtract.security_review_status == "rejected"
    ).count()

    overridden_pending = db.query(TodoExtract).filter(
        TodoExtract.is_overridden_by_batch == True,
        TodoExtract.needs_security_review == True,
        TodoExtract.security_review_status == "pending"
    ).count()

    return {
        "total_pending": total_pending,
        "total_approved": total_approved,
        "total_rejected": total_rejected,
        "overridden_pending": overridden_pending,
        "note": "人工改判被批跑覆盖的记录，必须经安全审核后才能归为正常"
    }


def get_overridden_items_for_review(db: Session) -> List[Dict[str, Any]]:
    todos = db.query(TodoExtract).filter(
        TodoExtract.is_overridden_by_batch == True,
        TodoExtract.needs_security_review == True
    ).order_by(TodoExtract.updated_at.desc()).all()

    result = []
    for todo in todos:
        judgments = [j for j in todo.judgments if j.is_overridden]
        latest_judgment = judgments[0] if judgments else None

        result.append({
            "todo_id": todo.id,
            "meeting_id": todo.meeting_id,
            "meeting_title": todo.meeting_title,
            "todo_content_preview": todo.todo_content[:200],
            "original_desensitization_level": latest_judgment.original_value.get("desensitization_level") if latest_judgment else None,
            "current_desensitization_level": todo.desensitization_level,
            "manual_judged_by": latest_judgment.judge_by if latest_judgment else None,
            "manual_judged_at": latest_judgment.judge_at.isoformat() if latest_judgment and latest_judgment.judge_at else None,
            "judgment_reason": latest_judgment.reason if latest_judgment else None,
            "overridden_by_batch_id": todo.overridden_by_batch_id,
            "security_review_status": todo.security_review_status,
            "created_at": todo.created_at.isoformat(),
            "updated_at": todo.updated_at.isoformat()
        })

    return result
