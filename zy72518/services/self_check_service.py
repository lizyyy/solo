from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from models import SelfCheckResult, TodoExtract, ManualJudgment, ImportBatch, ExportRecord
from datetime import datetime
from typing import List, Dict, Any
import hashlib
import json


def run_all_self_checks(db: Session, operator: str = "system") -> List[SelfCheckResult]:
    results = []
    results.append(check_duplicate_imports(db, operator))
    results.append(check_manual_judgment_overridden(db, operator))
    results.append(check_supplement_recalculation(db, operator))
    results.append(check_export_consistency(db, operator))
    return results


def check_duplicate_imports(db: Session, operator: str = "system") -> SelfCheckResult:
    issues = []
    duplicates = db.query(
        TodoExtract.meeting_id,
        TodoExtract.todo_content,
        TodoExtract.import_batch_id
    ).group_by(
        TodoExtract.meeting_id,
        TodoExtract.todo_content
    ).having(
        func.count(TodoExtract.id) > 1
    ).all()

    for dup in duplicates:
        todos = db.query(TodoExtract).filter(
            TodoExtract.meeting_id == dup.meeting_id,
            TodoExtract.todo_content == dup.todo_content
        ).order_by(TodoExtract.created_at).all()

        issues.append({
            "meeting_id": dup.meeting_id,
            "todo_content_preview": dup.todo_content[:100],
            "duplicate_count": len(todos),
            "import_batches": [t.import_batch_id for t in todos],
            "first_import_at": todos[0].created_at.isoformat(),
            "last_import_at": todos[-1].created_at.isoformat()
        })

    result = SelfCheckResult(
        check_type="duplicate_import",
        check_name="重复导入检测",
        status="passed" if len(issues) == 0 else "warning",
        issues_found=len(issues),
        details={"duplicates": issues},
        checked_by=operator,
        checked_at=datetime.utcnow()
    )
    db.add(result)
    db.commit()
    return result


def check_manual_judgment_overridden(db: Session, operator: str = "system") -> SelfCheckResult:
    issues = []
    overridden_judgments = db.query(ManualJudgment).filter(
        ManualJudgment.is_overridden == True
    ).all()

    for judgment in overridden_judgments:
        todo = db.query(TodoExtract).filter(TodoExtract.id == judgment.todo_id).first()
        if todo:
            issues.append({
                "todo_id": todo.id,
                "meeting_id": todo.meeting_id,
                "todo_content_preview": todo.todo_content[:100],
                "judged_by": judgment.judge_by,
                "judged_at": judgment.judge_at.isoformat(),
                "changed_fields": judgment.changed_fields,
                "overridden_by_batch_id": judgment.overridden_by_batch_id,
                "needs_security_review": todo.needs_security_review,
                "security_review_status": todo.security_review_status
            })

    result = SelfCheckResult(
        check_type="manual_judgment_overridden",
        check_name="人工改判被批跑覆盖检测",
        status="passed" if len(issues) == 0 else "warning",
        issues_found=len(issues),
        details={"overridden_records": issues},
        checked_by=operator,
        checked_at=datetime.utcnow()
    )
    db.add(result)
    db.commit()
    return result


def check_supplement_recalculation(db: Session, operator: str = "system") -> SelfCheckResult:
    issues = []
    import_batches = db.query(ImportBatch).order_by(ImportBatch.imported_at.desc()).limit(10).all()

    for batch in import_batches:
        todos = db.query(TodoExtract).filter(
            TodoExtract.import_batch_id == batch.batch_id
        ).all()

        has_inconsistent = False
        inconsistent_details = []
        for todo in todos:
            if todo.is_overridden_by_batch and todo.gray_batch_id:
                original_judgment = db.query(ManualJudgment).filter(
                    ManualJudgment.todo_id == todo.id,
                    ManualJudgment.is_overridden == True
                ).order_by(ManualJudgment.judge_at.desc()).first()

                if original_judgment:
                    has_inconsistent = True
                    inconsistent_details.append({
                        "todo_id": todo.id,
                        "original_judged_by": original_judgment.judge_by,
                        "original_judged_at": original_judgment.judge_at.isoformat(),
                        "overridden_by_batch": todo.overridden_by_batch_id
                    })

        if has_inconsistent:
            issues.append({
                "import_batch_id": batch.batch_id,
                "import_type": batch.import_type,
                "imported_at": batch.imported_at.isoformat(),
                "inconsistent_count": len(inconsistent_details),
                "details": inconsistent_details
            })

    result = SelfCheckResult(
        check_type="supplement_recalculation",
        check_name="补录后重算一致性检测",
        status="passed" if len(issues) == 0 else "warning",
        issues_found=len(issues),
        details={"inconsistent_batches": issues},
        checked_by=operator,
        checked_at=datetime.utcnow()
    )
    db.add(result)
    db.commit()
    return result


def check_export_consistency(db: Session, operator: str = "system") -> SelfCheckResult:
    issues = []
    recent_exports = db.query(ExportRecord).order_by(ExportRecord.exported_at.desc()).limit(5).all()

    for export in recent_exports:
        query_params = export.source_query or {}
        source_todos = _get_todos_by_query(db, query_params)
        current_hash = _calculate_data_hash(source_todos)

        if export.data_hash and export.data_hash != current_hash:
            issues.append({
                "export_id": export.id,
                "export_type": export.export_type,
                "exported_at": export.exported_at.isoformat(),
                "exported_by": export.exported_by,
                "original_record_count": export.record_count,
                "current_record_count": len(source_todos),
                "hash_mismatch": True,
                "note": "导出后数据有变更，需重新导出以保证一致性"
            })

    result = SelfCheckResult(
        check_type="export_consistency",
        check_name="导出一致性校验",
        status="passed" if len(issues) == 0 else "warning",
        issues_found=len(issues),
        details={"inconsistent_exports": issues},
        checked_by=operator,
        checked_at=datetime.utcnow()
    )
    db.add(result)
    db.commit()
    return result


def _get_todos_by_query(db: Session, query_params: Dict[str, Any]) -> List[TodoExtract]:
    query = db.query(TodoExtract)
    if query_params.get("gray_batch_id"):
        query = query.filter(TodoExtract.gray_batch_id == query_params["gray_batch_id"])
    if query_params.get("status"):
        query = query.filter(TodoExtract.status == query_params["status"])
    if query_params.get("import_batch_id"):
        query = query.filter(TodoExtract.import_batch_id == query_params["import_batch_id"])
    return query.order_by(TodoExtract.id).all()


def _calculate_data_hash(todos: List[TodoExtract]) -> str:
    data_list = []
    for todo in todos:
        data_list.append({
            "id": todo.id,
            "meeting_id": todo.meeting_id,
            "todo_content": todo.todo_content,
            "desensitization_level": todo.desensitization_level,
            "status": todo.status,
            "is_manual_judgment": todo.is_manual_judgment,
            "is_overridden_by_batch": todo.is_overridden_by_batch,
            "security_review_status": todo.security_review_status,
            "updated_at": todo.updated_at.isoformat()
        })
    data_str = json.dumps(data_list, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(data_str.encode("utf-8")).hexdigest()


def get_latest_check_results(db: Session) -> List[SelfCheckResult]:
    subquery = db.query(
        SelfCheckResult.check_type,
        func.max(SelfCheckResult.checked_at).label("max_checked_at")
    ).group_by(SelfCheckResult.check_type).subquery()

    return db.query(SelfCheckResult).join(
        subquery,
        and_(
            SelfCheckResult.check_type == subquery.c.check_type,
            SelfCheckResult.checked_at == subquery.c.max_checked_at
        )
    ).all()
