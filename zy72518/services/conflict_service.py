from sqlalchemy.orm import Session
from models import ConflictRecord, TodoExtract, DesensitizationRule, GrayBatch
from datetime import datetime
from typing import List, Dict, Any, Tuple


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
                    ConflictRecord.status.in_(["pending", "resolved"])
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
) -> Tuple[ConflictRecord, List[ConflictRecord]]:
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

    sibling_resolved = _auto_resolve_sibling_conflicts(
        db, conflict.todo_id, conflict.batch_id, operator, resolution
    )

    db.commit()
    return conflict, sibling_resolved


def _auto_resolve_sibling_conflicts(
    db: Session,
    todo_id: int,
    batch_id: int,
    operator: str,
    trigger_resolution: str
) -> List[ConflictRecord]:
    todo = db.query(TodoExtract).filter(TodoExtract.id == todo_id).first()
    if not todo:
        return []

    siblings = db.query(ConflictRecord).filter(
        ConflictRecord.todo_id == todo_id,
        ConflictRecord.batch_id == batch_id,
        ConflictRecord.status == "pending"
    ).all()

    resolved = []
    for sibling in siblings:
        if _is_conflict_stale(sibling, todo):
            sibling.status = "resolved"
            sibling.resolution = "auto_resolved_by_sibling"
            sibling.resolution_note = (
                f"同一待办已被{operator}以'{trigger_resolution}'方式处理主冲突，"
                f"当前待办脱敏级别为{todo.desensitization_level}，"
                f"此条冲突不再适用，自动关闭"
            )
            sibling.resolved_by = f"auto({operator})"
            sibling.resolved_at = datetime.utcnow()
            resolved.append(sibling)

    return resolved


def _is_conflict_stale(conflict: ConflictRecord, todo: TodoExtract) -> bool:
    recorded_level = conflict.evidence.get("todo_desensitization_level") if conflict.evidence else None
    if recorded_level and todo.desensitization_level != recorded_level:
        return True
    return False


def reconcile_stale_conflicts(db: Session, batch_id: int) -> Dict[str, Any]:
    pending_conflicts = db.query(ConflictRecord).filter(
        ConflictRecord.batch_id == batch_id,
        ConflictRecord.status == "pending"
    ).all()

    auto_resolved = []
    still_pending = []

    for conflict in pending_conflicts:
        todo = db.query(TodoExtract).filter(TodoExtract.id == conflict.todo_id).first()
        if not todo:
            conflict.status = "resolved"
            conflict.resolution = "auto_resolved_orphan"
            conflict.resolution_note = "关联待办已删除，自动关闭"
            conflict.resolved_by = "auto_reconcile"
            conflict.resolved_at = datetime.utcnow()
            auto_resolved.append(conflict)
            continue

        if _is_conflict_stale(conflict, todo):
            conflict.status = "resolved"
            conflict.resolution = "auto_resolved_stale"
            conflict.resolution_note = (
                f"待办脱敏级别已变更为{todo.desensitization_level}，"
                f"与冲突记录时的{conflict.evidence.get('todo_desensitization_level')}不同，"
                f"此条冲突不再适用，自动关闭"
            )
            conflict.resolved_by = "auto_reconcile"
            conflict.resolved_at = datetime.utcnow()
            auto_resolved.append(conflict)
        else:
            still_pending.append(conflict)

    db.commit()

    return {
        "batch_id": batch_id,
        "checked_pending": len(pending_conflicts),
        "auto_resolved": len(auto_resolved),
        "still_pending": len(still_pending),
        "auto_resolved_details": [
            {
                "conflict_id": c.id,
                "todo_id": c.todo_id,
                "resolution": c.resolution,
                "resolution_note": c.resolution_note
            }
            for c in auto_resolved
        ],
        "still_pending_details": [
            {
                "conflict_id": c.id,
                "todo_id": c.todo_id,
                "rule_value": c.rule_value,
                "batch_value": c.batch_value
            }
            for c in still_pending
        ]
    }


def get_pending_conflicts(db: Session, batch_id: int = None) -> List[ConflictRecord]:
    query = db.query(ConflictRecord).filter(ConflictRecord.status == "pending")
    if batch_id:
        query = query.filter(ConflictRecord.batch_id == batch_id)
    return query.all()


def get_conflicts_by_todo(db: Session, todo_id: int) -> List[ConflictRecord]:
    return db.query(ConflictRecord).filter(
        ConflictRecord.todo_id == todo_id
    ).order_by(ConflictRecord.created_at).all()


def get_conflict_summary_for_batch(db: Session, batch_id: int) -> Dict[str, Any]:
    from models import TodoExtract

    all_conflicts = db.query(ConflictRecord).filter(
        ConflictRecord.batch_id == batch_id
    ).all()

    current_todo_ids = set(
        t.id for t in db.query(TodoExtract).filter(
            TodoExtract.gray_batch_id == batch_id
        ).all()
    )

    all_pending = [c for c in all_conflicts if c.status == "pending"]
    all_resolved = [c for c in all_conflicts if c.status == "resolved"]

    in_scope_pending = [c for c in all_pending if c.todo_id in current_todo_ids]
    in_scope_resolved = [c for c in all_resolved if c.todo_id in current_todo_ids]

    excluded_pending = [c for c in all_pending if c.todo_id not in current_todo_ids]
    excluded_resolved = [c for c in all_resolved if c.todo_id not in current_todo_ids]

    in_scope_todos_with_pending = set(c.todo_id for c in in_scope_pending)
    all_todos_with_pending = set(c.todo_id for c in all_pending)

    moved_todo_details = []
    for tid in set(c.todo_id for c in excluded_pending + excluded_resolved):
        todo = db.query(TodoExtract).filter(TodoExtract.id == tid).first()
        moved_todo_details.append({
            "todo_id": tid,
            "current_batch_id": todo.gray_batch_id if todo else None,
            "pending_conflicts_count": len([c for c in excluded_pending if c.todo_id == tid]),
            "resolved_conflicts_count": len([c for c in excluded_resolved if c.todo_id == tid]),
            "conflict_ids": [c.id for c in excluded_pending + excluded_resolved if c.todo_id == tid],
            "reason": "待办已迁移至批次" + str(todo.gray_batch_id) if todo else "待办已删除",
            "action_required": "应由批次" + str(todo.gray_batch_id) + "的负责人确认后迁移或关闭" if todo else "需人工确认关闭"
        })

    return {
        "batch_id": batch_id,
        "raw_total_conflicts": len(all_conflicts),
        "raw_pending_conflicts": len(all_pending),
        "raw_resolved_conflicts": len(all_resolved),
        "pending_conflicts": len(in_scope_pending),
        "resolved_conflicts": len(in_scope_resolved),
        "unique_todos_with_pending": len(in_scope_todos_with_pending),
        "unique_todos_affected": len(set(c.todo_id for c in all_conflicts if c.todo_id in current_todo_ids)),
        "excluded_pending_conflicts": len(excluded_pending),
        "excluded_moved_todos": moved_todo_details,
        "pending_by_todo": {
            str(tid): len([c for c in in_scope_pending if c.todo_id == tid])
            for tid in in_scope_todos_with_pending
        },
        "explanation": (
            "批次" + str(batch_id) + "共有" + str(len(all_pending)) + "条pending冲突记录，"
            "其中" + str(len(in_scope_pending)) + "条属于当前批次待办，"
            + str(len(excluded_pending)) + "条属于已迁移待办（不计入当前批次准确率）。"
            "已迁移待办的冲突仍保持pending状态，"
            "应由迁移目标批次的负责人确认后迁移或关闭。"
        ) if excluded_pending else (
            "批次" + str(batch_id) + "共有" + str(len(all_pending)) + "条pending冲突记录，"
            "均属于当前批次待办。"
        )
    }
