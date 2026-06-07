from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import (
    DesensitizationRuleCreate, GrayBatchCreate,
    GrayBatchReviewRequest, ConflictResolveRequest,
    ConflictRecordResponse
)
from services.workflow_service import (
    step1_import_desensitization_rules,
    step2_xiaomeng_review_gray_batch,
    step3_update_evaluation_report,
    get_workflow_status
)
from services.conflict_service import get_pending_conflicts, resolve_conflict
from models import GrayBatch, DesensitizationRule

router = APIRouter(prefix="/api/workflow", tags=["工作流"])


@router.post("/step1/import-rules")
def import_rules(
    rules_data: List[DesensitizationRuleCreate],
    imported_by: str = "admin",
    db: Session = Depends(get_db)
):
    rules_list = [r.dict() for r in rules_data]
    rules, import_batch = step1_import_desensitization_rules(
        db, rules_list, imported_by
    )
    return {
        "code": 0,
        "message": "第一步：脱敏规则导入完成",
        "data": {
            "import_batch_id": import_batch.batch_id,
            "imported_count": len(rules),
            "duplicate_count": import_batch.duplicate_count,
            "imported_by": imported_by
        }
    }


@router.post("/step2/review-batch/{batch_id}")
def review_batch(
    batch_id: int,
    request: GrayBatchReviewRequest,
    db: Session = Depends(get_db)
):
    try:
        batch, conflicts, self_check_summary = step2_xiaomeng_review_gray_batch(
            db, batch_id, request.reviewed_by, request.review_note
        )
        return {
            "code": 0,
            "message": "第二步：模型评测同事小孟灰度批次审阅完成",
            "data": {
                "batch_id": batch.id,
                "batch_name": batch.batch_name,
                "reviewed_by": batch.reviewed_by,
                "conflicts_found": len(conflicts),
                "conflicts": [
                    {
                        "id": c.id,
                        "todo_id": c.todo_id,
                        "conflict_type": c.conflict_type,
                        "rule_value": c.rule_value,
                        "batch_value": c.batch_value,
                        "description": c.description,
                        "evidence": c.evidence
                    }
                    for c in conflicts
                ],
                "self_check": self_check_summary,
                "note": "请小孟确认或驳回冲突，不要自动拍板"
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/step3/update-report/{batch_id}")
def update_report(
    batch_id: int,
    updated_by: str = "admin",
    db: Session = Depends(get_db)
):
    try:
        report = step3_update_evaluation_report(db, batch_id, updated_by)
        return {
            "code": 0,
            "message": "第三步：评测报告更新完成",
            "data": {
                "report_id": report.id,
                "batch_id": report.batch_id,
                "accuracy_rate": report.accuracy_rate,
                "recall_rate": report.recall_rate,
                "f1_score": report.f1_score,
                "conflict_count": report.conflict_count,
                "manual_judgment_count": report.manual_judgment_count,
                "status": report.status,
                "pending_security_review_count": len(
                    report.report_content.get("pending_review_items", [])
                )
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status/{batch_id}")
def workflow_status(batch_id: int, db: Session = Depends(get_db)):
    return get_workflow_status(db, batch_id)


@router.get("/conflicts/pending", response_model=List[ConflictRecordResponse])
def pending_conflicts(batch_id: int = None, db: Session = Depends(get_db)):
    return get_pending_conflicts(db, batch_id)


@router.post("/conflicts/{conflict_id}/resolve")
def resolve_conflict_api(
    conflict_id: int,
    request: ConflictResolveRequest,
    db: Session = Depends(get_db)
):
    try:
        if request.resolution not in ["confirm", "reject"]:
            raise HTTPException(status_code=400, detail="resolution must be 'confirm' or 'reject'")
        
        conflict = resolve_conflict(
            db, conflict_id, request.resolution,
            request.resolution_note, request.operator
        )
        return {
            "code": 0,
            "message": f"冲突已{request.resolution == 'confirm' and '确认' or '驳回'}",
            "data": {
                "conflict_id": conflict.id,
                "resolution": conflict.resolution,
                "resolved_by": conflict.resolved_by,
                "note": request.resolution == "confirm" and "已按脱敏规则备注执行，需安全审核" or "已按灰度批次期望执行"
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch/create")
def create_batch(batch_data: GrayBatchCreate, db: Session = Depends(get_db)):
    batch = GrayBatch(**batch_data.dict())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return {
        "code": 0,
        "message": "灰度批次创建成功",
        "data": {
            "batch_id": batch.id,
            "batch_code": batch.batch_code,
            "batch_name": batch.batch_name
        }
    }
