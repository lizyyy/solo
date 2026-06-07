from sqlalchemy.orm import Session
from models import ConflictRecord, TodoExtract, DesensitizationRule, GrayBatch
from datetime import datetime
from typing import List, Dict, Any


def detect_desensitization_conflicts(db: Session, batch_id: int) -> List[ConflictRecord]:
    batch = db.query(GrayBatch).filter(GrayBatch.id == batch_id).first()
    if not batch:
        return []

    todos = db.query(TodoExtract).filter(
        TodoExtract.gray_batch_id == batch_id,
        TodoExtract.desensitization_note.isnot(None)
    ).all()

    conflicts = []
    for todo in todos:
        rules = db.query(DesensitizationRule).filter(
            DesensitizationRule.is_active == True
        ).all()

        for rule in rules:
            if _check_conflict(todo, batch, rule):
                existing = db.query(ConflictRecord).filter(
                    ConflictRecord.todo_id == todo.id,
                    ConflictRecord.rule_id == rule.id,
                    ConflictRecord.batch_id == batch_id,
                    ConflictRecord.status == "pending"
                ).first()

                if not existing:
                    conflict = _create_conflict_record(todo, batch, rule)
                    db.add(conflict)
                    conflicts.append(conflict)

    db.commit()
    return conflicts


def _check_conflict(todo: TodoExtract, batch: GrayBatch, rule: DesensitizationRule) -> bool:
    if todo.desensitization_level and batch.expected_desensitization_level:
        if todo.desensitization_level != batch.expected_desensitization_level:
            if rule.desensitization_level == todo.desensitization_level:
                return True

    if todo.desensitization_note and rule.note:
        if "例外" in todo.desensitization_note and "严格" in rule.note:
            return True
        if "不脱敏" in todo.desensitization_note and "必须脱敏" in rule.note:
            return True

    return False


def _create_conflict_record(todo: TodoExtract, batch: GrayBatch, rule: DesensitizationRule) -> ConflictRecord:
    evidence = {
        "todo_id": todo.id,
        "todo_content": todo.todo_content,
        "todo_desensitization_level": todo.desensitization_level,
        "todo_desensitization_note": todo.desensitization_note,
        "rule_id": rule.id,
        "rule_name": rule.rule_name,
        "rule_level": rule.desensitization_level,
        "rule_note": rule.note,
        "batch_id": batch.id,
        "batch_name": batch.batch_name,
        "batch_expected_level": batch.expected_desensitization_level,
        "batch_note": batch.note,
        "contradiction_point": f"规则要求{rule.desensitization_level}，但批次期望{batch.expected_desensitization_level}"
    }

    return ConflictRecord(
        rule_id=rule.id,
        batch_id=batch.id,
        todo_id=todo.id,
        conflict_type="desensitization_level_mismatch",
        rule_value=rule.desensitization_level,
        batch_value=batch.expected_desensitization_level,
        description=f"脱敏规则备注与灰度批次期望不一致：规则{rule.rule_name}要求{rule.desensitization_level}，批次{batch.batch_name}期望{batch.expected_desensitization_level}",
        evidence=evidence,
        status="pending"
    )


def resolve_conflict(
    db: Session,
    conflict_id: int,
    resolution: str,
    resolution_note: str,
    operator: str
) -> ConflictRecord:
    conflict = db.query(ConflictRecord).filter(ConflictRecord.id == conflict_id).first()
    if not conflict:
        raise ValueError(f"Conflict {conflict_id} not found")

    conflict.status = "resolved"
    conflict.resolution = resolution
    conflict.resolution_note = resolution_note
    conflict.resolved_by = operator
    conflict.resolved_at = datetime.utcnow()

    if resolution == "confirm":
        todo = db.query(TodoExtract).filter(TodoExtract.id == conflict.todo_id).first()
        if todo:
            todo.desensitization_level = conflict.rule_value
            todo.needs_security_review = True
            todo.security_review_status = "pending"
    elif resolution == "reject":
        todo = db.query(TodoExtract).filter(TodoExtract.id == conflict.todo_id).first()
        if todo:
            todo.desensitization_level = conflict.batch_value

    db.commit()
    return conflict


def get_pending_conflicts(db: Session, batch_id: int = None) -> List[ConflictRecord]:
    query = db.query(ConflictRecord).filter(ConflictRecord.status == "pending")
    if batch_id:
        query = query.filter(ConflictRecord.batch_id == batch_id)
    return query.all()
