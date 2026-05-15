from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import TaskBatch, TaskResult, AttributionResult, AttributionRule, EdgeNode, IoTReceipt, TaskStatus, RiskType
from app.schemas import (
    TaskBatchCreate, TaskBatch as TaskBatchSchema,
    TaskResultCreate, TaskResult as TaskResultSchema,
    EdgeNodeCreate, EdgeNode as EdgeNodeSchema,
    AttributionRuleCreate, AttributionRule as AttributionRuleSchema,
    IoTReceiptCreate, IoTReceipt as IoTReceiptSchema,
    ManualModifyRequest, AttributionAnalysisRequest,
    RollbackCandidateResponse
)
from app.services.rule_engine import RuleEngine, initialize_default_rules
from app.services.output_service import OutputService
from app.services.rollback_service import RollbackService

router = APIRouter()


@router.on_event("startup")
def startup_event():
    db = next(get_db())
    initialize_default_rules(db)


@router.post("/batches/", response_model=TaskBatchSchema)
def create_batch(batch: TaskBatchCreate, db: Session = Depends(get_db)):
    db_batch = TaskBatch(**batch.dict())
    db_batch.status = TaskStatus.RUNNING
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


@router.get("/batches/", response_model=List[TaskBatchSchema])
def list_batches(
    operator: Optional[str] = None,
    risk_type: Optional[RiskType] = None,
    status: Optional[TaskStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TaskBatch)

    if operator:
        query = query.filter(TaskBatch.operator.contains(operator))
    if risk_type:
        query = query.filter(TaskBatch.risk_type == risk_type)
    if status:
        query = query.filter(TaskBatch.status == status)

    return query.order_by(TaskBatch.started_at.desc()).all()


@router.get("/batches/{batch_id}", response_model=TaskBatchSchema)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(TaskBatch).filter(TaskBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("/batches/{batch_id}/complete")
def complete_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(TaskBatch).filter(TaskBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    task_results = db.query(TaskResult).filter(TaskResult.batch_id == batch_id).all()
    batch.total_tasks = len(task_results)
    batch.success_count = sum(1 for t in task_results if t.status == TaskStatus.SUCCESS)
    batch.failed_count = sum(1 for t in task_results if t.status != TaskStatus.SUCCESS)

    if batch.success_count == batch.total_tasks:
        batch.status = TaskStatus.SUCCESS
    elif batch.failed_count == batch.total_tasks:
        batch.status = TaskStatus.FAILED
    else:
        batch.status = TaskStatus.PARTIAL_SUCCESS

    batch.completed_at = datetime.now()
    db.commit()
    return {"status": "completed", "batch_id": batch_id}


@router.post("/tasks/", response_model=TaskResultSchema)
def create_task_result(task: TaskResultCreate, db: Session = Depends(get_db)):
    db_task = TaskResult(**task.dict())
    if task.is_early_terminated:
        db_task.status = TaskStatus.EARLY_TERMINATED
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/tasks/batch/{batch_id}", response_model=List[TaskResultSchema])
def get_batch_tasks(batch_id: str, db: Session = Depends(get_db)):
    return db.query(TaskResult).filter(TaskResult.batch_id == batch_id).all()


@router.post("/edge-nodes/", response_model=EdgeNodeSchema)
def create_edge_node(node: EdgeNodeCreate, db: Session = Depends(get_db)):
    db_node = EdgeNode(**node.dict())
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node


@router.get("/edge-nodes/", response_model=List[EdgeNodeSchema])
def list_edge_nodes(db: Session = Depends(get_db)):
    return db.query(EdgeNode).all()


@router.post("/rules/", response_model=AttributionRuleSchema)
def create_rule(rule: AttributionRuleCreate, db: Session = Depends(get_db)):
    db_rule = AttributionRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.get("/rules/", response_model=List[AttributionRuleSchema])
def list_rules(db: Session = Depends(get_db)):
    return db.query(AttributionRule).filter(AttributionRule.is_active == True).all()


@router.post("/attribution/analyze")
def analyze_attribution(request: AttributionAnalysisRequest, db: Session = Depends(get_db)):
    if request.edge_node_inventory:
        for node_data in request.edge_node_inventory:
            existing = db.query(EdgeNode).filter(EdgeNode.node_id == node_data.node_id).first()
            if not existing:
                db_node = EdgeNode(**node_data.dict())
                db.add(db_node)
        db.commit()

    rule_engine = RuleEngine(db)
    results = rule_engine.analyze_batch(request.batch_id)

    batch = db.query(TaskBatch).filter(TaskBatch.batch_id == request.batch_id).first()
    if batch:
        early_terminated_count = sum(1 for r in results if r.blocked_by_rule)
        if early_terminated_count > 0:
            risk_types = [r.risk_type for r in results if r.risk_type != RiskType.UNKNOWN]
            if risk_types:
                batch.risk_type = max(set(risk_types), key=risk_types.count)

        db.commit()

    output_service = OutputService(db)
    return output_service.generate_json_output(request.batch_id)


@router.patch("/attribution/{task_id}/manual-modify")
def manual_modify_attribution(task_id: str, request: ManualModifyRequest, db: Session = Depends(get_db)):
    attribution = db.query(AttributionResult).filter(AttributionResult.task_id == task_id).first()
    if not attribution:
        raise HTTPException(status_code=404, detail="Attribution result not found")

    attribution.original_conclusion = attribution.block_reason
    attribution.block_reason = request.new_conclusion
    attribution.is_manual_modified = True
    attribution.modified_by = request.modified_by
    attribution.modified_at = datetime.now()

    db.commit()
    return {
        "task_id": task_id,
        "original_conclusion": attribution.original_conclusion,
        "new_conclusion": attribution.block_reason,
        "modified_by": attribution.modified_by
    }


@router.get("/output/{batch_id}/json")
def get_json_output(batch_id: str, db: Session = Depends(get_db)):
    output_service = OutputService(db)
    return output_service.generate_json_output(batch_id)


@router.get("/output/{batch_id}/markdown")
def get_markdown_output(batch_id: str, db: Session = Depends(get_db)):
    output_service = OutputService(db)
    md_content = output_service.generate_markdown_output(batch_id)
    return Response(content=md_content, media_type="text/markdown")


@router.get("/output/{batch_id}/download")
def download_excel_report(batch_id: str, db: Session = Depends(get_db)):
    output_service = OutputService(db)
    excel_data = output_service.generate_excel_data(batch_id)

    if not excel_data:
        raise HTTPException(status_code=404, detail="Batch not found")

    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=attribution_report_{batch_id}.xlsx"}
    )


@router.post("/rollback/candidates/{batch_id}")
def generate_rollback_candidates(batch_id: str, created_by: str, db: Session = Depends(get_db)):
    rollback_service = RollbackService(db)
    candidates = rollback_service.generate_rollback_candidates(batch_id, created_by)
    return [
        {
            "candidate_id": c.candidate_id,
            "task_count": len(c.task_ids.split(",")),
            "reason": c.reason,
            "risk_level": c.risk_level,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in candidates
    ]


@router.get("/rollback/candidates/{batch_id}", response_model=List[RollbackCandidateResponse])
def get_batch_rollback_candidates(batch_id: str, db: Session = Depends(get_db)):
    rollback_service = RollbackService(db)
    return rollback_service.get_batch_candidates(batch_id)


@router.get("/rollback/candidate/{candidate_id}")
def get_rollback_candidate(candidate_id: str, db: Session = Depends(get_db)):
    rollback_service = RollbackService(db)
    return rollback_service.get_candidate_details(candidate_id)


@router.post("/rollback/candidate/{candidate_id}/approve")
def approve_rollback_candidate(candidate_id: str, approved_by: str, db: Session = Depends(get_db)):
    rollback_service = RollbackService(db)
    success = rollback_service.approve_candidate(candidate_id, approved_by)
    if not success:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"status": "approved", "candidate_id": candidate_id}


@router.post("/iot-receipts/", response_model=IoTReceiptSchema)
def create_iot_receipt(receipt: IoTReceiptCreate, db: Session = Depends(get_db)):
    db_receipt = IoTReceipt(**receipt.dict())
    db.add(db_receipt)
    db.commit()
    db.refresh(db_receipt)
    return db_receipt


@router.get("/iot-receipts/task/{task_id}")
def get_task_iot_receipts(task_id: str, responsibility_team: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(IoTReceipt).filter(IoTReceipt.task_id == task_id)
    if responsibility_team:
        query = query.filter(IoTReceipt.responsibility_team.contains(responsibility_team))
    return query.all()


@router.get("/iot-receipts/node/{node_id}")
def get_node_iot_receipts(node_id: str, db: Session = Depends(get_db)):
    return db.query(IoTReceipt).filter(IoTReceipt.node_id == node_id).all()


@router.get("/attribution/history")
def get_attribution_history(
    batch_id: Optional[str] = None,
    operator: Optional[str] = None,
    risk_type: Optional[RiskType] = None,
    is_manual_modified: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AttributionResult)

    if batch_id:
        query = query.filter(AttributionResult.batch_id == batch_id)
    if risk_type:
        query = query.filter(AttributionResult.risk_type == risk_type)
    if is_manual_modified is not None:
        query = query.filter(AttributionResult.is_manual_modified == is_manual_modified)
    if operator:
        query = query.join(TaskBatch, TaskBatch.batch_id == AttributionResult.batch_id)
        query = query.filter(TaskBatch.operator.contains(operator))

    results = query.order_by(AttributionResult.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "task_id": r.task_id,
            "batch_id": r.batch_id,
            "blocked_by_rule": r.blocked_by_rule,
            "blocked_by_rule_code": r.blocked_by_rule_code,
            "block_reason": r.block_reason,
            "risk_type": r.risk_type.value,
            "confidence_score": r.confidence_score,
            "is_manual_modified": r.is_manual_modified,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in results
    ]
