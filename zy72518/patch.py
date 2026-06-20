#!/usr/bin/env python3
"""Patch workflow_service.py - fix accuracy calc, add reconcile, add helpers."""
import os

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'services', 'workflow_service.py')
with open(path, 'r') as f:
    src = f.read()

src = src.replace(
    'from services.conflict_service import detect_desensitization_conflicts',
    'from services.conflict_service import (\n    detect_desensitization_conflicts,\n    reconcile_stale_conflicts,\n    get_conflict_summary_for_batch\n)'
)

src = src.replace(
    '    conflicts = detect_desensitization_conflicts(db, batch_id)\n\n    batch.status = "reviewed"\n    batch.reviewed_by = reviewed_by\n    batch.reviewed_at = datetime.utcnow()\n    batch.review_note = review_note or f"模型评测同事{reviewed_by}完成灰度批次审阅，发现{len(conflicts)}个冲突待确认"',
    '    reconcile_result = reconcile_stale_conflicts(db, batch_id)\n    conflicts = detect_desensitization_conflicts(db, batch_id)\n    conflict_summary = get_conflict_summary_for_batch(db, batch_id)\n\n    batch.status = "reviewed"\n    batch.reviewed_by = reviewed_by\n    batch.reviewed_at = datetime.utcnow()\n    if not review_note:\n        review_note = (\n            "模型评测同事" + reviewed_by + "完成灰度批次审阅，"\n            "发现" + str(conflict_summary["unique_todos_with_pending"]) + "条待办有"\n            + str(conflict_summary["pending_conflicts"]) + "个冲突待确认，"\n            "已自动对齐" + str(reconcile_result["auto_resolved"]) + "条过期冲突"\n        )\n    batch.review_note = review_note'
)

src = src.replace(
    '    todos = db.query(TodoExtract).filter(TodoExtract.gray_batch_id == batch_id).all()\n    conflicts = db.query(ConflictRecord).filter(ConflictRecord.batch_id == batch_id).all()',
    '    reconcile_result = reconcile_stale_conflicts(db, batch_id)\n\n    todos = db.query(TodoExtract).filter(TodoExtract.gray_batch_id == batch_id).all()\n    conflicts = db.query(ConflictRecord).filter(ConflictRecord.batch_id == batch_id).all()'
)

src = src.replace(
    '    if total_todos > 0:\n        accuracy_rate = (total_todos - len(pending_conflicts)) / total_todos\n    else:\n        accuracy_rate = 1.0',
    '    todos_with_pending_conflicts = set(c.todo_id for c in pending_conflicts)\n    todos_with_resolved_conflicts = set(c.todo_id for c in resolved_conflicts)\n    todos_no_conflicts = total_todos - len(todos_with_pending_conflicts | todos_with_resolved_conflicts)\n\n    if total_todos > 0:\n        accuracy_rate = (total_todos - len(todos_with_pending_conflicts)) / total_todos\n        accuracy_rate = max(0.0, min(1.0, accuracy_rate))\n    else:\n        accuracy_rate = 1.0\n\n    accuracy_explanation = _build_accuracy_explanation(\n        total_todos, len(todos_with_pending_conflicts),\n        len(pending_conflicts), len(resolved_conflicts),\n        todos_no_conflicts, reconcile_result\n    )\n\n    conflict_summary = get_conflict_summary_for_batch(db, batch_id)\n    todo_status_list = _build_todo_status_list(db, todos, conflicts)'
)

src = src.replace(
    '            "total_conflicts": len(conflicts),\n            "resolved_conflicts": len(resolved_conflicts),\n            "pending_conflicts": len(pending_conflicts),',
    '            "total_conflict_records": len(conflicts),\n            "pending_conflict_records": len(pending_conflicts),\n            "resolved_conflict_records": len(resolved_conflicts),\n            "unique_todos_with_pending_conflicts": len(todos_with_pending_conflicts),\n            "unique_todos_with_resolved_conflicts": len(todos_with_resolved_conflicts),\n            "todos_without_any_conflict": todos_no_conflicts,'
)

src = src.replace(
    '        },\n        "conflict_details":',
    '        },\n        "accuracy_explanation": accuracy_explanation,\n        "conflict_summary": conflict_summary,\n        "reconcile_result": reconcile_result,\n        "todo_status_list": todo_status_list,\n        "conflict_details":'
)

src = src.replace(
    '                "resolved_by": c.resolved_by\n            }',
    '                "resolved_by": c.resolved_by,\n                "resolution_note": c.resolution_note\n            }'
)

src = src.replace(
    '    existing_report = db.query(EvaluationReport).filter(EvaluationReport.batch_id == batch_id).first()\n    if existing_report:\n        existing_report.report_content = report_content\n        existing_report.accuracy_rate = accuracy_rate\n        existing_report.recall_rate = 0.95\n        existing_report.f1_score = (2 * accuracy_rate * 0.95) / (accuracy_rate + 0.95) if (accuracy_rate + 0.95) > 0 else 0',
    '    recall_rate = 0.95\n    f1_score = (2 * accuracy_rate * recall_rate) / (accuracy_rate + recall_rate) if (accuracy_rate + recall_rate) > 0 else 0\n\n    existing_report = db.query(EvaluationReport).filter(EvaluationReport.batch_id == batch_id).first()\n    if existing_report:\n        existing_report.report_content = report_content\n        existing_report.accuracy_rate = accuracy_rate\n        existing_report.recall_rate = recall_rate\n        existing_report.f1_score = f1_score'
)

src = src.replace(
    '            recall_rate=0.95,\n            f1_score=(2 * accuracy_rate * 0.95) / (accuracy_rate + 0.95) if (accuracy_rate + 0.95) > 0 else 0,',
    '            recall_rate=recall_rate,\n            f1_score=f1_score,'
)

src = src.replace(
    '    conflicts = db.query(ConflictRecord).filter(ConflictRecord.batch_id == batch_id).all()\n\n    return {\n        "batch_id": batch_id,\n        "batch_name": batch.batch_name,\n        "current_step": _determine_current_step(batch, report),\n        "steps": {\n            "step1_import_rules": {\n                "status": "completed",\n                "description": "脱敏规则已导入"\n            },\n            "step2_xiaomeng_review": {\n                "status": "completed" if batch.status == "reviewed" else "pending",\n                "description": f"模型评测同事小孟灰度批次审阅{\'已完成\' if batch.status == \'reviewed\' else \'待完成\'}",\n                "reviewed_by": batch.reviewed_by,\n                "reviewed_at": batch.reviewed_at.isoformat() if batch.reviewed_at else None,\n                "conflict_count": len(conflicts)\n            },\n            "step3_update_report": {\n                "status": "completed" if report and report.status == "final" else "pending",\n                "description": f"评测报告{\'已更新\' if report and report.status == \'final\' else \'待更新\'}",\n                "report_id": report.id if report else None\n            }\n        }\n    }',
    '    conflict_summary = get_conflict_summary_for_batch(db, batch_id)\n\n    return {\n        "batch_id": batch_id,\n        "batch_name": batch.batch_name,\n        "current_step": _determine_current_step(batch, report),\n        "conflict_summary": conflict_summary,\n        "steps": {\n            "step1_import_rules": {\n                "status": "completed",\n                "description": "脱敏规则已导入"\n            },\n            "step2_xiaomeng_review": {\n                "status": "completed" if batch.status == "reviewed" else "pending",\n                "description": "模型评测同事小孟灰度批次审阅" + ("已完成" if batch.status == "reviewed" else "待完成"),\n                "reviewed_by": batch.reviewed_by,\n                "reviewed_at": batch.reviewed_at.isoformat() if batch.reviewed_at else None,\n                "pending_conflicts": conflict_summary["pending_conflicts"],\n                "unique_todos_with_pending": conflict_summary["unique_todos_with_pending"]\n            },\n            "step3_update_report": {\n                "status": "completed" if report and report.status == "final" else "pending",\n                "description": "评测报告" + ("已更新" if report and report.status == "final" else "待更新"),\n                "report_id": report.id if report else None\n            }\n        }\n    }'
)

helpers = '''

def _build_accuracy_explanation(
    total_todos: int,
    todos_with_pending: int,
    pending_records: int,
    resolved_records: int,
    todos_no_conflicts: int,
    reconcile_result: Dict[str, Any]
) -> Dict[str, Any]:
    parts = []
    parts.append("本批次共" + str(total_todos) + "条待办。")

    auto = reconcile_result.get("auto_resolved", 0)
    if auto > 0:
        parts.append(
            "报告生成前自动对齐" + str(auto) + "条过期冲突"
            "（这些冲突记录时的脱敏级别与当前待办实际级别不一致，已自动关闭）。"
        )

    if todos_with_pending > 0:
        avg = pending_records / todos_with_pending
        parts.append(
            "其中" + str(todos_with_pending) + "条待办仍有" + str(pending_records) + "个冲突待确认"
            "（平均每条待办" + f"{avg:.1f}" + "个冲突记录，"
            "因同一待办可能与多条规则冲突）。"
        )
    else:
        parts.append("所有冲突均已处理。")

    if total_todos > 0:
        rate = (total_todos - todos_with_pending) / total_todos
        parts.append(
            "准确率 = (总待办" + str(total_todos) + " - 有未处理冲突的待办" + str(todos_with_pending) + ")"
            " / 总待办" + str(total_todos) + " = " + f"{rate:.2%}"
        )
    else:
        parts.append("准确率 = 100%（无待办）")

    parts.append(
        "注意：准确率按「有未处理冲突的待办数」计算，而非原始冲突记录数。"
        "原始冲突记录" + str(pending_records + resolved_records) + "条"
        "（待处理" + str(pending_records) + "、已处理" + str(resolved_records) + "），"
        "但一条待办可能对应多条冲突记录。"
    )

    return {
        "accuracy_formula": "accuracy = (total_todos - todos_with_pending_conflicts) / total_todos",
        "total_todos": total_todos,
        "todos_with_pending_conflicts": todos_with_pending,
        "pending_conflict_records": pending_records,
        "resolved_conflict_records": resolved_records,
        "todos_without_any_conflict": todos_no_conflicts,
        "reconcile_auto_resolved": auto,
        "narrative": " ".join(parts)
    }


def _build_todo_status_list(
    db: Session,
    todos: List[TodoExtract],
    conflicts: List[ConflictRecord]
) -> List[Dict[str, Any]]:
    result = []
    for todo in todos:
        todo_conflicts = [c for c in conflicts if c.todo_id == todo.id]
        pending = [c for c in todo_conflicts if c.status == "pending"]
        resolved = [c for c in todo_conflicts if c.status == "resolved"]

        status_label = "无冲突"
        if pending:
            status_label = "有" + str(len(pending)) + "个冲突待确认"
        elif resolved:
            status_label = "冲突已处理(" + str(len(resolved)) + "个)"

        result.append({
            "todo_id": todo.id,
            "meeting_id": todo.meeting_id,
            "meeting_title": todo.meeting_title,
            "todo_content_preview": todo.todo_content[:80],
            "desensitization_level": todo.desensitization_level,
            "is_manual_judgment": todo.is_manual_judgment,
            "is_overridden_by_batch": todo.is_overridden_by_batch,
            "needs_security_review": todo.needs_security_review,
            "security_review_status": todo.security_review_status,
            "conflict_status": status_label,
            "pending_conflict_count": len(pending),
            "resolved_conflict_count": len(resolved)
        })

    return result

'''

src = src.replace(
    '\ndef _determine_current_step',
    helpers + 'def _determine_current_step'
)

with open(path, 'w') as f:
    f.write(src)

print("Patched successfully")
