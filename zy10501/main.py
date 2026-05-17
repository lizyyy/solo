from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import traceback
import json

from database import engine, get_db, Base
import models
import schemas
from models import BatchStatus, ClaimStatus, DesensitizationType
from services import DesensitizationEngine, AuthorizationService, ExceptionRecorder, AccessLogger

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="接口样本脱敏授权API",
    description="用于管理接口样本脱敏、授权审批和领取留痕的系统",
    version="1.0.0"
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    db = next(get_db())
    try:
        body = await request.body()
        original_input = {
            "url": str(request.url),
            "method": request.method,
            "headers": dict(request.headers),
            "body": body.decode() if body else None
        }
    except:
        original_input = {"url": str(request.url), "method": request.method}

    ExceptionRecorder.record_exception(
        db=db,
        operation="api_request",
        operator="system",
        original_input=original_input,
        error_message=str(exc),
        stack_trace=traceback.format_exc()
    )

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "message": str(exc)}
    )


@app.get("/")
def root():
    return {"message": "接口样本脱敏授权API服务已启动", "docs": "/docs"}


@app.post("/rules/", response_model=schemas.DesensitizationRule)
def create_desensitization_rule(
    rule: schemas.DesensitizationRuleCreate,
    db: Session = Depends(get_db)
):
    db_rule = models.DesensitizationRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@app.get("/rules/", response_model=List[schemas.DesensitizationRule])
def list_desensitization_rules(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    rules = db.query(models.DesensitizationRule).offset(skip).limit(limit).all()
    return rules


@app.post("/batches/", response_model=schemas.SampleBatch)
def create_batch(
    batch: schemas.SampleBatchCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(models.SampleBatch).filter(
        models.SampleBatch.batch_no == batch.batch_no
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="批次编号已存在")

    db_batch = models.SampleBatch(
        batch_no=batch.batch_no,
        name=batch.name,
        description=batch.description,
        status=BatchStatus.DRAFT,
        created_by=batch.created_by,
        expire_at=batch.expire_at
    )
    db.add(db_batch)
    db.flush()

    for api_path in batch.api_paths:
        db_api_path = models.ApiPath(batch_id=db_batch.id, **api_path.dict())
        db.add(db_api_path)

    for field in batch.sensitive_fields:
        db_field = models.SensitiveField(batch_id=db_batch.id, **field.dict())
        db.add(db_field)

    for scope in batch.authorization_scopes:
        db_scope = models.AuthorizationScope(batch_id=db_batch.id, **scope.dict())
        db.add(db_scope)

    db.commit()
    db.refresh(db_batch)
    return db_batch


@app.get("/batches/", response_model=List[schemas.SampleBatch])
def list_batches(
    status: Optional[BatchStatus] = None,
    created_by: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.SampleBatch)
    if status:
        query = query.filter(models.SampleBatch.status == status)
    if created_by:
        query = query.filter(models.SampleBatch.created_by == created_by)
    batches = query.order_by(models.SampleBatch.created_at.desc()).offset(skip).limit(limit).all()
    return batches


@app.get("/batches/{batch_id}", response_model=schemas.SampleBatch)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.patch("/batches/{batch_id}", response_model=schemas.SampleBatch)
def update_batch(
    batch_id: int,
    update: schemas.SampleBatchUpdate,
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    update_data = update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(batch, key, value)

    db.commit()
    db.refresh(batch)
    return batch


@app.post("/batches/{batch_id}/submit")
def submit_batch_for_approval(
    batch_id: int,
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if batch.status != BatchStatus.DRAFT:
        raise HTTPException(status_code=400, detail="只有草稿状态可以提交审批")

    batch.status = BatchStatus.PENDING_APPROVAL
    db.commit()
    db.refresh(batch)
    return {"message": "已提交审批", "batch_id": batch_id, "status": batch.status}


@app.post("/batches/{batch_id}/approve")
def approve_batch(
    batch_id: int,
    approver: str = Query(..., description="审批人"),
    comment: Optional[str] = Query(None, description="审批意见"),
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if batch.status != BatchStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="只有待审批状态可以审批")

    batch.status = BatchStatus.APPROVED
    batch.approver = approver
    batch.approval_comment = comment
    db.commit()
    db.refresh(batch)
    return {"message": "审批通过", "batch_id": batch_id, "status": batch.status}


@app.post("/batches/{batch_id}/reject")
def reject_batch(
    batch_id: int,
    approver: str = Query(..., description="审批人"),
    comment: str = Query(..., description="拒绝原因"),
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if batch.status != BatchStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="只有待审批状态可以审批")

    batch.status = BatchStatus.REJECTED
    batch.approver = approver
    batch.approval_comment = comment
    db.commit()
    db.refresh(batch)
    return {"message": "已拒绝", "batch_id": batch_id, "status": batch.status}


@app.get("/batches/{batch_id}/report", response_model=schemas.BatchReport)
def get_batch_report(
    batch_id: int,
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    total_api_paths = len(batch.api_paths)
    total_sensitive_fields = len(batch.sensitive_fields)
    total_claims = db.query(models.ClaimRecord).filter(models.ClaimRecord.batch_id == batch_id).count()
    approved_claims = db.query(models.ClaimRecord).filter(
        models.ClaimRecord.batch_id == batch_id,
        models.ClaimRecord.status == ClaimStatus.APPROVED
    ).count()
    active_claims = db.query(models.ClaimRecord).filter(
        models.ClaimRecord.batch_id == batch_id,
        models.ClaimRecord.status == ClaimStatus.APPROVED,
        models.ClaimRecord.expire_at > datetime.now()
    ).count()
    total_exceptions = db.query(models.ExceptionRecord).filter(models.ExceptionRecord.batch_id == batch_id).count()
    unresolved_exceptions = db.query(models.ExceptionRecord).filter(
        models.ExceptionRecord.batch_id == batch_id,
        models.ExceptionRecord.resolved == False
    ).count()

    return schemas.BatchReport(
        batch_id=batch.id,
        batch_no=batch.batch_no,
        name=batch.name,
        status=batch.status,
        total_api_paths=total_api_paths,
        total_sensitive_fields=total_sensitive_fields,
        total_claims=total_claims,
        approved_claims=approved_claims,
        active_claims=active_claims,
        total_exceptions=total_exceptions,
        unresolved_exceptions=unresolved_exceptions,
        created_at=batch.created_at,
        expire_at=batch.expire_at
    )


@app.post("/claims/", response_model=schemas.ClaimRecord)
def create_claim(
    claim: schemas.ClaimRecordCreate,
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == claim.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if batch.status != BatchStatus.APPROVED:
        raise HTTPException(status_code=400, detail="只有已审批的批次可以申请领取")

    db_claim = models.ClaimRecord(
        batch_id=claim.batch_id,
        claimant=claim.claimant,
        claimant_email=claim.claimant_email,
        purpose=claim.purpose,
        status=ClaimStatus.PENDING
    )
    db.add(db_claim)
    db.commit()
    db.refresh(db_claim)
    return db_claim


@app.get("/claims/", response_model=List[schemas.ClaimRecord])
def list_claims(
    batch_id: Optional[int] = None,
    claimant: Optional[str] = None,
    status: Optional[ClaimStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.ClaimRecord)
    if batch_id:
        query = query.filter(models.ClaimRecord.batch_id == batch_id)
    if claimant:
        query = query.filter(models.ClaimRecord.claimant == claimant)
    if status:
        query = query.filter(models.ClaimRecord.status == status)
    claims = query.order_by(models.ClaimRecord.created_at.desc()).offset(skip).limit(limit).all()
    return claims


@app.post("/claims/{claim_id}/approve", response_model=schemas.ClaimRecord)
def approve_claim(
    claim_id: int,
    approval: schemas.ClaimRecordApproval,
    db: Session = Depends(get_db)
):
    try:
        return AuthorizationService.approve_claim(
            db=db,
            claim_id=claim_id,
            approver=approval.approver,
            comment=approval.approval_comment
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/claims/{claim_id}/revoke", response_model=schemas.ClaimRecord)
def revoke_claim(
    claim_id: int,
    revoke: schemas.ClaimRecordRevoke,
    db: Session = Depends(get_db)
):
    try:
        return AuthorizationService.revoke_claim(
            db=db,
            claim_id=claim_id,
            operator=revoke.operator,
            reason=revoke.revoke_reason
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/desensitize", response_model=schemas.DesensitizeResponse)
def desensitize_data(
    request: schemas.DesensitizeRequest,
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == request.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if request.claim_id:
        claim = db.query(models.ClaimRecord).filter(models.ClaimRecord.id == request.claim_id).first()
        if not claim or claim.status != ClaimStatus.APPROVED:
            raise HTTPException(status_code=403, detail="未授权或领取已过期")
        if claim.expire_at and claim.expire_at < datetime.now():
            raise HTTPException(status_code=403, detail="领取已过期")

    sensitive_fields = db.query(models.SensitiveField).filter(
        models.SensitiveField.batch_id == request.batch_id
    ).all()

    result, applied_rules = DesensitizationEngine.desensitize_data(
        data=request.data,
        sensitive_fields=sensitive_fields
    )

    if request.claim_id:
        AccessLogger.log_access(
            db=db,
            claim_id=request.claim_id,
            access_type="desensitize",
            request_data={"batch_id": request.batch_id},
            response_data={"applied_rules": applied_rules}
        )

    return schemas.DesensitizeResponse(
        success=True,
        data=result,
        message="脱敏完成",
        applied_rules=applied_rules
    )


@app.get("/exceptions/", response_model=List[schemas.ExceptionRecord])
def list_exceptions(
    batch_id: Optional[int] = None,
    resolved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.ExceptionRecord)
    if batch_id:
        query = query.filter(models.ExceptionRecord.batch_id == batch_id)
    if resolved is not None:
        query = query.filter(models.ExceptionRecord.resolved == resolved)
    exceptions = query.order_by(models.ExceptionRecord.created_at.desc()).offset(skip).limit(limit).all()
    return exceptions


@app.post("/exceptions/{exception_id}/resolve", response_model=schemas.ExceptionRecord)
def resolve_exception(
    exception_id: int,
    resolve: schemas.ExceptionRecordResolve,
    db: Session = Depends(get_db)
):
    exception = db.query(models.ExceptionRecord).filter(models.ExceptionRecord.id == exception_id).first()
    if not exception:
        raise HTTPException(status_code=404, detail="异常记录不存在")

    exception.resolved = True
    exception.resolver = resolve.resolver
    exception.resolution_comment = resolve.resolution_comment
    exception.resolved_at = datetime.now()

    db.commit()
    db.refresh(exception)
    return exception


@app.post("/corrections/", response_model=schemas.ManualCorrection)
def create_manual_correction(
    correction: schemas.ManualCorrectionCreate,
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == correction.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    db_correction = models.ManualCorrection(
        batch_id=correction.batch_id,
        field_path=correction.field_path,
        original_value=correction.original_value,
        corrected_value=correction.corrected_value,
        reason=correction.reason,
        corrected_by=correction.corrected_by,
        approved=False
    )
    db.add(db_correction)
    db.commit()
    db.refresh(db_correction)
    return db_correction


@app.get("/corrections/", response_model=List[schemas.ManualCorrection])
def list_manual_corrections(
    batch_id: Optional[int] = None,
    approved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.ManualCorrection)
    if batch_id:
        query = query.filter(models.ManualCorrection.batch_id == batch_id)
    if approved is not None:
        query = query.filter(models.ManualCorrection.approved == approved)
    corrections = query.order_by(models.ManualCorrection.created_at.desc()).offset(skip).limit(limit).all()
    return corrections


@app.post("/corrections/{correction_id}/approve", response_model=schemas.ManualCorrection)
def approve_manual_correction(
    correction_id: int,
    approval: schemas.ManualCorrectionApprove,
    db: Session = Depends(get_db)
):
    correction = db.query(models.ManualCorrection).filter(models.ManualCorrection.id == correction_id).first()
    if not correction:
        raise HTTPException(status_code=404, detail="人工修正记录不存在")

    correction.approved = approval.approved
    correction.approved_by = approval.approved_by
    correction.approved_at = datetime.now()

    db.commit()
    db.refresh(correction)
    return correction


@app.get("/export/batches/{batch_id}")
def export_batch(
    batch_id: int,
    format: str = Query("json", enum=["json", "csv"]),
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    export_data = {
        "batch": {
            "id": batch.id,
            "batch_no": batch.batch_no,
            "name": batch.name,
            "description": batch.description,
            "status": batch.status,
            "created_by": batch.created_by,
            "created_at": batch.created_at.isoformat(),
            "expire_at": batch.expire_at.isoformat() if batch.expire_at else None
        },
        "api_paths": [
            {"path": p.path, "method": p.method, "sample_count": p.sample_count, "description": p.description}
            for p in batch.api_paths
        ],
        "sensitive_fields": [
            {"field_path": f.field_path, "field_type": f.field_type, "rule_name": f.rule.name if f.rule else None}
            for f in batch.sensitive_fields
        ],
        "authorization_scopes": [
            {"scope_type": s.scope_type, "scope_value": s.scope_value, "max_claims": s.max_claims, "claim_hours": s.claim_hours}
            for s in batch.authorization_scopes
        ],
        "claims": [
            {"claimant": c.claimant, "purpose": c.purpose, "status": c.status, "created_at": c.created_at.isoformat()}
            for c in batch.claim_records
        ],
        "exceptions": [
            {"operation": e.operation, "error_message": e.error_message, "resolved": e.resolved, "created_at": e.created_at.isoformat()}
            for e in batch.exception_records
        ]
    }

    if format == "json":
        return export_data
    else:
        return {"message": "CSV导出功能开发中", "data": export_data}


@app.get("/access-logs/", response_model=List[schemas.AccessLog])
def list_access_logs(
    claim_id: Optional[int] = None,
    access_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.AccessLog)
    if claim_id:
        query = query.filter(models.AccessLog.claim_id == claim_id)
    if access_type:
        query = query.filter(models.AccessLog.access_type == access_type)
    logs = query.order_by(models.AccessLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs


@app.post("/maintenance/expire-claims")
def run_expire_claims(db: Session = Depends(get_db)):
    count = AuthorizationService.expire_claims(db)
    return {"message": f"已过期 {count} 个领取记录"}


@app.post("/test/exception")
def test_exception(
    operator: str = "test_user",
    db: Session = Depends(get_db)
):
    try:
        raise ValueError("这是一个测试异常")
    except Exception as e:
        ExceptionRecorder.record_exception(
            db=db,
            operation="test_exception",
            operator=operator,
            original_input={"test": "data", "timestamp": datetime.now().isoformat()},
            error_message=str(e),
            processing_basis={"test_mode": True},
            stack_trace=traceback.format_exc()
        )
    return {"message": "异常已记录"}


@app.post("/test/unauthorized-desensitize")
def test_unauthorized_desensitize(
    batch_id: int,
    claim_id: int = 99999,
    db: Session = Depends(get_db)
):
    batch = db.query(models.SampleBatch).filter(models.SampleBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    claim = db.query(models.ClaimRecord).filter(models.ClaimRecord.id == claim_id).first()
    if not claim or claim.status != ClaimStatus.APPROVED:
        ExceptionRecorder.record_exception(
            db=db,
            batch_id=batch_id,
            operation="unauthorized_desensitize",
            operator="test_user",
            original_input={"batch_id": batch_id, "claim_id": claim_id},
            error_message="未授权的脱敏操作尝试",
            processing_basis={"claim_status": claim.status if claim else "not_found"}
        )
        raise HTTPException(status_code=403, detail="未授权或领取已过期 - 此异常已被记录")

    return {"message": "授权验证通过"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
