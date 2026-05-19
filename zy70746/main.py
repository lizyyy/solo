from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
import json

from database import (
    get_db, init_db, ReleaseBatch, Metric, ThresholdRule,
    DecisionRecord, DecisionDetail, RollbackSummary,
    RollbackStatus as DBRollbackStatus, MetricType as DBMetricType
)
from schemas import (
    ReleaseBatchCreate, ReleaseBatch as ReleaseBatchSchema,
    MetricCreate, Metric as MetricSchema,
    ThresholdRuleCreate, ThresholdRule as ThresholdRuleSchema,
    DecisionRecord as DecisionRecordSchema,
    ManualOverride, RollbackDecisionResponse,
    RollbackSummary as RollbackSummarySchema,
    ErrorCode, ErrorResponse
)

app = FastAPI(title="回滚指标裁决人工覆写API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": ErrorCode.VALIDATION_ERROR, "message": str(exc.detail)}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    missing_fields = []
    for error in exc.errors():
        if error.get("type") == "missing":
            loc = error.get("loc", [])
            field_name = ".".join(str(x) for x in loc if x != "body")
            missing_fields.append(field_name)
    
    if missing_fields:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=ErrorResponse(
                code=ErrorCode.MISSING_FIELDS,
                message=f"Missing required fields: {', '.join(missing_fields)}",
                details={"missing_fields": missing_fields}
            ).dict()
        )
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=ErrorResponse(
            code=ErrorCode.VALIDATION_ERROR,
            message="Validation error",
            details={"errors": exc.errors()}
        ).dict()
    )


@app.post("/api/batches/", response_model=ReleaseBatchSchema, status_code=status.HTTP_201_CREATED)
def create_batch(batch: ReleaseBatchCreate, db: Session = Depends(get_db)):
    db_batch = db.query(ReleaseBatch).filter(ReleaseBatch.batch_id == batch.batch_id).first()
    if db_batch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=ErrorCode.ALREADY_PROCESSED,
                message=f"Batch {batch.batch_id} already exists",
                details={"batch_id": batch.batch_id}
            ).dict()
        )
    
    db_batch = ReleaseBatch(**batch.dict())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


@app.get("/api/batches/", response_model=List[ReleaseBatchSchema])
def list_batches(skip: int = 0, limit: int = 100, environment: str = None, db: Session = Depends(get_db)):
    query = db.query(ReleaseBatch)
    if environment:
        query = query.filter(ReleaseBatch.environment == environment)
    return query.offset(skip).limit(limit).all()


@app.get("/api/batches/{batch_id}", response_model=ReleaseBatchSchema)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(ReleaseBatch).filter(ReleaseBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                code=ErrorCode.NOT_FOUND,
                message=f"Batch {batch_id} not found",
                details={"batch_id": batch_id}
            ).dict()
        )
    return batch


@app.post("/api/metrics/", response_model=MetricSchema, status_code=status.HTTP_201_CREATED)
def create_metric(metric: MetricCreate, db: Session = Depends(get_db)):
    batch = db.query(ReleaseBatch).filter(ReleaseBatch.batch_id == metric.batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                code=ErrorCode.NOT_FOUND,
                message=f"Batch {metric.batch_id} not found",
                details={"batch_id": metric.batch_id}
            ).dict()
        )
    
    db_metric = Metric(**metric.dict())
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)
    return db_metric


@app.get("/api/batches/{batch_id}/metrics/", response_model=List[MetricSchema])
def get_batch_metrics(batch_id: str, metric_type: str = None, db: Session = Depends(get_db)):
    query = db.query(Metric).filter(Metric.batch_id == batch_id)
    if metric_type:
        query = query.filter(Metric.metric_type == metric_type)
    return query.all()


@app.post("/api/thresholds/", response_model=ThresholdRuleSchema, status_code=status.HTTP_201_CREATED)
def create_threshold_rule(rule: ThresholdRuleCreate, db: Session = Depends(get_db)):
    db_rule = ThresholdRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@app.get("/api/thresholds/", response_model=List[ThresholdRuleSchema])
def list_threshold_rules(metric_type: str = None, is_active: bool = None, db: Session = Depends(get_db)):
    query = db.query(ThresholdRule)
    if metric_type:
        query = query.filter(ThresholdRule.metric_type == metric_type)
    if is_active is not None:
        query = query.filter(ThresholdRule.is_active == is_active)
    return query.all()


def aggregate_metrics(batch_id: str, db: Session) -> Dict[str, Any]:
    metrics = db.query(Metric).filter(Metric.batch_id == batch_id).all()
    if not metrics:
        return {"aggregated": False, "metrics": [], "core_metrics_count": 0, "aux_metrics_count": 0}
    
    core_metrics = [m for m in metrics if m.metric_type == DBMetricType.CORE]
    aux_metrics = [m for m in metrics if m.metric_type == DBMetricType.AUXILIARY]
    
    aggregated = {
        "core_metrics": {},
        "auxiliary_metrics": {}
    }
    
    for m in core_metrics:
        change_rate = (m.current_value - m.baseline_value) / m.baseline_value if m.baseline_value != 0 else 0
        aggregated["core_metrics"][m.metric_name] = {
            "current": m.current_value,
            "baseline": m.baseline_value,
            "change_rate": change_rate,
            "unit": m.unit
        }
    
    for m in aux_metrics:
        change_rate = (m.current_value - m.baseline_value) / m.baseline_value if m.baseline_value != 0 else 0
        aggregated["auxiliary_metrics"][m.metric_name] = {
            "current": m.current_value,
            "baseline": m.baseline_value,
            "change_rate": change_rate,
            "unit": m.unit
        }
    
    return {
        "aggregated": True,
        "metrics": aggregated,
        "core_metrics_count": len(core_metrics),
        "aux_metrics_count": len(aux_metrics)
    }


@app.post("/api/batches/{batch_id}/aggregate/")
def aggregate_batch_metrics(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(ReleaseBatch).filter(ReleaseBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                code=ErrorCode.NOT_FOUND,
                message=f"Batch {batch_id} not found"
            ).dict()
        )
    
    result = aggregate_metrics(batch_id, db)
    return {"batch_id": batch_id, **result}


def compare_value(value: float, operator: str, threshold: float) -> bool:
    operators = {
        ">": lambda v, t: v > t,
        "<": lambda v, t: v < t,
        ">=": lambda v, t: v >= t,
        "<=": lambda v, t: v <= t,
        "==": lambda v, t: v == t,
        "!=": lambda v, t: v != t
    }
    if operator not in operators:
        return False
    return operators[operator](value, threshold)


def make_threshold_decision(batch_id: str, db: Session) -> Dict[str, Any]:
    metrics = db.query(Metric).filter(Metric.batch_id == batch_id).all()
    rules = db.query(ThresholdRule).filter(ThresholdRule.is_active == True).all()
    
    if not metrics or not rules:
        return {
            "decision": "pending",
            "confidence": 0.0,
            "needs_manual_review": True,
            "details": [],
            "reason": "Insufficient metrics or rules"
        }
    
    metric_map = {m.metric_name: m for m in metrics}
    details = []
    total_weight = 0
    passed_weight = 0
    core_violations = 0
    
    for rule in rules:
        metric = metric_map.get(rule.metric_name)
        if not metric:
            continue
        
        if rule.threshold_type == "change_rate":
            value = (metric.current_value - metric.baseline_value) / metric.baseline_value if metric.baseline_value != 0 else 0
        else:
            value = metric.current_value
        
        passed = compare_value(value, rule.comparison_operator, rule.threshold_value)
        
        details.append({
            "metric_name": rule.metric_name,
            "current_value": value,
            "threshold_value": rule.threshold_value,
            "passed": passed,
            "weight": rule.weight
        })
        
        total_weight += rule.weight
        if passed:
            passed_weight += rule.weight
        elif rule.metric_type == DBMetricType.CORE:
            core_violations += 1
    
    if total_weight == 0:
        confidence = 0.0
    else:
        confidence = passed_weight / total_weight
    
    if core_violations > 0:
        decision = "rollback"
        needs_manual_review = confidence < 0.8
    elif confidence >= 0.9:
        decision = "proceed"
        needs_manual_review = False
    elif confidence >= 0.7:
        decision = "proceed_with_caution"
        needs_manual_review = True
    else:
        decision = "review_required"
        needs_manual_review = True
    
    return {
        "decision": decision,
        "confidence": confidence,
        "needs_manual_review": needs_manual_review,
        "details": details,
        "core_violations": core_violations
    }


@app.post("/api/batches/{batch_id}/decide/", response_model=RollbackDecisionResponse)
def make_decision(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(ReleaseBatch).filter(ReleaseBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                code=ErrorCode.NOT_FOUND,
                message=f"Batch {batch_id} not found"
            ).dict()
        )
    
    existing_decision = db.query(DecisionRecord).filter(DecisionRecord.batch_id == batch_id).first()
    if existing_decision and existing_decision.status not in [DBRollbackStatus.PENDING, DBRollbackStatus.NEEDS_MANUAL_REVIEW]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=ErrorCode.ALREADY_PROCESSED,
                message=f"Decision for batch {batch_id} has already been processed",
                details={"current_status": existing_decision.status}
            ).dict()
        )
    
    decision_result = make_threshold_decision(batch_id, db)
    
    if decision_result["needs_manual_review"]:
        status_enum = DBRollbackStatus.NEEDS_MANUAL_REVIEW
        message = "Decision requires manual review"
    elif decision_result["decision"] == "rollback":
        status_enum = DBRollbackStatus.AUTO_REJECTED
        message = "Auto rollback triggered"
    else:
        status_enum = DBRollbackStatus.AUTO_APPROVED
        message = "Auto approval granted"
    
    if existing_decision:
        existing_decision.status = status_enum
        existing_decision.auto_decision = decision_result["decision"]
        existing_decision.auto_confidence = decision_result["confidence"]
        decision_record = existing_decision
    else:
        decision_record = DecisionRecord(
            batch_id=batch_id,
            status=status_enum,
            auto_decision=decision_result["decision"],
            auto_confidence=decision_result["confidence"]
        )
        db.add(decision_record)
        db.flush()
    
    db.query(DecisionDetail).filter(DecisionDetail.decision_id == decision_record.id).delete()
    
    for detail in decision_result["details"]:
        db_detail = DecisionDetail(
            decision_id=decision_record.id,
            **detail
        )
        db.add(db_detail)
    
    db.commit()
    db.refresh(decision_record)
    
    return RollbackDecisionResponse(
        batch_id=batch_id,
        status=status_enum.value,
        auto_decision=decision_result["decision"],
        auto_confidence=decision_result["confidence"],
        needs_manual_review=decision_result["needs_manual_review"],
        message=message
    )


@app.get("/api/batches/{batch_id}/decision/", response_model=DecisionRecordSchema)
def get_decision(batch_id: str, db: Session = Depends(get_db)):
    decision = db.query(DecisionRecord).filter(DecisionRecord.batch_id == batch_id).first()
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                code=ErrorCode.NOT_FOUND,
                message=f"Decision for batch {batch_id} not found"
            ).dict()
        )
    return decision


@app.post("/api/batches/{batch_id}/override/", response_model=DecisionRecordSchema)
def manual_override(batch_id: str, override: ManualOverride, db: Session = Depends(get_db)):
    decision = db.query(DecisionRecord).filter(DecisionRecord.batch_id == batch_id).first()
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                code=ErrorCode.NOT_FOUND,
                message=f"Decision for batch {batch_id} not found"
            ).dict()
        )
    
    if decision.status in [DBRollbackStatus.EXECUTED, DBRollbackStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=ErrorCode.INVALID_STATE,
                message=f"Cannot override decision in current state: {decision.status}",
                details={"current_status": decision.status}
            ).dict()
        )
    
    if decision.manual_decision is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=ErrorCode.ALREADY_PROCESSED,
                message=f"Decision for batch {batch_id} has already been manually overridden",
                details={"previous_decision": decision.manual_decision}
            ).dict()
        )
    
    if override.decision == "approve":
        decision.status = DBRollbackStatus.MANUAL_APPROVED
    elif override.decision == "reject":
        decision.status = DBRollbackStatus.MANUAL_REJECTED
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=ErrorCode.VALIDATION_ERROR,
                message=f"Invalid decision: {override.decision}. Must be 'approve' or 'reject'",
                details={"valid_decisions": ["approve", "reject"]}
            ).dict()
        )
    
    decision.manual_decision = override.decision
    decision.manual_operator = override.operator
    decision.manual_reason = override.reason
    decision.manual_timestamp = datetime.utcnow()
    
    db.commit()
    db.refresh(decision)
    return decision


@app.post("/api/batches/{batch_id}/execute/")
def execute_decision(batch_id: str, db: Session = Depends(get_db)):
    decision = db.query(DecisionRecord).filter(DecisionRecord.batch_id == batch_id).first()
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                code=ErrorCode.NOT_FOUND,
                message=f"Decision for batch {batch_id} not found"
            ).dict()
        )
    
    if decision.status == DBRollbackStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=ErrorCode.INVALID_STATE,
                message="Decision is still pending, cannot execute"
            ).dict()
        )
    
    if decision.status == DBRollbackStatus.NEEDS_MANUAL_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=ErrorCode.NEEDS_MANUAL_REVIEW,
                message="Decision requires manual review before execution",
                details={"batch_id": batch_id}
            ).dict()
        )
    
    if decision.status == DBRollbackStatus.EXECUTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=ErrorCode.ALREADY_PROCESSED,
                message="Decision has already been executed"
            ).dict()
        )
    
    decision.status = DBRollbackStatus.EXECUTED
    db.commit()
    
    return {
        "batch_id": batch_id,
        "status": DBRollbackStatus.EXECUTED.value,
        "final_decision": decision.manual_decision or decision.auto_decision,
        "message": "Decision executed successfully"
    }


@app.post("/api/batches/{batch_id}/export/", response_model=RollbackSummarySchema)
def export_summary(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(ReleaseBatch).filter(ReleaseBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                code=ErrorCode.NOT_FOUND,
                message=f"Batch {batch_id} not found"
            ).dict()
        )
    
    decision = db.query(DecisionRecord).filter(DecisionRecord.batch_id == batch_id).first()
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                code=ErrorCode.INVALID_STATE,
                message=f"No decision found for batch {batch_id}, cannot export"
            ).dict()
        )
    
    metrics = db.query(Metric).filter(Metric.batch_id == batch_id).all()
    metrics_summary = json.dumps([{
        "name": m.metric_name,
        "type": m.metric_type.value,
        "current": m.current_value,
        "baseline": m.baseline_value,
        "unit": m.unit
    } for m in metrics])
    
    end_time = batch.end_time or datetime.utcnow()
    duration = int((end_time - batch.start_time).total_seconds())
    
    final_decision = decision.manual_decision or decision.auto_decision
    decision_method = "manual" if decision.manual_decision else "auto"
    
    summary = RollbackSummary(
        batch_id=batch_id,
        release_name=batch.release_name,
        version=batch.version,
        environment=batch.environment,
        final_decision=final_decision,
        decision_method=decision_method,
        operator=decision.manual_operator,
        reason=decision.manual_reason or decision.auto_decision,
        metrics_summary=metrics_summary,
        start_time=batch.start_time,
        end_time=end_time,
        duration_seconds=duration
    )
    
    db.add(summary)
    db.commit()
    db.refresh(summary)
    
    return summary


@app.get("/api/summaries/", response_model=List[RollbackSummarySchema])
def list_summaries(skip: int = 0, limit: int = 100, environment: str = None, db: Session = Depends(get_db)):
    query = db.query(RollbackSummary)
    if environment:
        query = query.filter(RollbackSummary.environment == environment)
    return query.order_by(RollbackSummary.exported_at.desc()).offset(skip).limit(limit).all()


@app.get("/api/decisions/", response_model=List[DecisionRecordSchema])
def list_decisions(
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(DecisionRecord)
    if status:
        query = query.filter(DecisionRecord.status == status)
    return query.order_by(DecisionRecord.created_at.desc()).offset(skip).limit(limit).all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
