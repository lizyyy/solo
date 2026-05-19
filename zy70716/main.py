from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
import io

from database import engine, get_db
import models
import schemas
from services import (
    FailureCaseService,
    ExemptionService,
    ReviewService,
    AuditService,
    BrowserMatrixService
)
from export_service import ExportService

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="浏览器兼容豁免失败样例追踪API")


@app.post("/api/v1/failures", response_model=schemas.FailureCaseResponse, tags=["失败样例"])
def create_failure_case(
    failure_data: schemas.FailureCaseCreate,
    db: Session = Depends(get_db)
):
    failure = FailureCaseService.create_failure_case(db, failure_data)
    
    AuditService.create_audit_log(
        db,
        operation_type="create",
        resource_type="failure_case",
        resource_id=failure.id,
        operator=failure_data.reporter,
        original_input=failure_data.model_dump(),
        process_result={"status": "success"}
    )
    
    return _enrich_failure_case_response(failure, db)


@app.get("/api/v1/failures", response_model=List[schemas.FailureCaseResponse], tags=["失败样例"])
def list_failure_cases(
    page_path: Optional[str] = None,
    conclusion: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    failures = FailureCaseService.list_failure_cases(db, page_path, conclusion, skip, limit)
    return [_enrich_failure_case_response(f, db) for f in failures]


@app.get("/api/v1/failures/{failure_id}", response_model=schemas.FailureCaseResponse, tags=["失败样例"])
def get_failure_case(
    failure_id: int,
    db: Session = Depends(get_db)
):
    failure = FailureCaseService.get_failure_case(db, failure_id)
    if not failure:
        raise HTTPException(status_code=404, detail="失败样例不存在")
    return _enrich_failure_case_response(failure, db)


@app.put("/api/v1/failures/{failure_id}/conclusion", response_model=schemas.FailureCaseResponse, tags=["失败样例"])
def update_conclusion(
    failure_id: int,
    conclusion_data: schemas.ConclusionUpdate,
    db: Session = Depends(get_db)
):
    failure = FailureCaseService.get_failure_case(db, failure_id)
    if not failure:
        raise HTTPException(status_code=404, detail="失败样例不存在")
    
    original_conclusion = failure.conclusion
    
    updated = FailureCaseService.update_conclusion(db, failure_id, conclusion_data)
    
    AuditService.create_audit_log(
        db,
        operation_type="update_conclusion",
        resource_type="failure_case",
        resource_id=failure_id,
        operator=conclusion_data.operator,
        original_input={"conclusion": conclusion_data.conclusion, "note": conclusion_data.conclusion_note},
        process_result={"previous_conclusion": original_conclusion, "new_conclusion": conclusion_data.conclusion}
    )
    
    return _enrich_failure_case_response(updated, db)


@app.post("/api/v1/exemptions", response_model=schemas.ExemptionResponse, tags=["豁免申请"])
def create_exemption(
    exemption_data: schemas.ExemptionCreate,
    db: Session = Depends(get_db)
):
    failure = FailureCaseService.get_failure_case(db, exemption_data.failure_id)
    if not failure:
        raise HTTPException(status_code=404, detail="关联的失败样例不存在")
    
    if ExemptionService.check_exemption_conflict(db, exemption_data.failure_id):
        AuditService.create_audit_log(
            db,
            operation_type="create_failed",
            resource_type="exemption",
            resource_id=exemption_data.failure_id,
            operator=exemption_data.applicant,
            original_input=exemption_data.model_dump(),
            process_result={"error": "该失败样例已有生效中的豁免", "status": "conflict"}
        )
        raise HTTPException(status_code=409, detail="该失败样例已有生效中的豁免")
    
    exemption = ExemptionService.create_exemption(db, exemption_data)
    
    AuditService.create_audit_log(
        db,
        operation_type="create",
        resource_type="exemption",
        resource_id=exemption.id,
        operator=exemption_data.applicant,
        original_input=exemption_data.model_dump(),
        process_result={"status": "pending"}
    )
    
    return _enrich_exemption_response(exemption)


@app.get("/api/v1/exemptions", response_model=List[schemas.ExemptionResponse], tags=["豁免申请"])
def list_exemptions(
    failure_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Exemption)
    if failure_id:
        query = query.filter(models.Exemption.failure_id == failure_id)
    if status:
        query = query.filter(models.Exemption.status == status)
    
    exemptions = query.offset(skip).limit(limit).all()
    return [_enrich_exemption_response(e) for e in exemptions]


@app.get("/api/v1/exemptions/{exemption_id}", response_model=schemas.ExemptionResponse, tags=["豁免申请"])
def get_exemption(
    exemption_id: int,
    db: Session = Depends(get_db)
):
    exemption = db.query(models.Exemption).filter(models.Exemption.id == exemption_id).first()
    if not exemption:
        raise HTTPException(status_code=404, detail="豁免申请不存在")
    return _enrich_exemption_response(exemption)


@app.put("/api/v1/exemptions/{exemption_id}/review", response_model=schemas.ExemptionResponse, tags=["豁免申请"])
def review_exemption(
    exemption_id: int,
    review_data: schemas.ExemptionReview,
    db: Session = Depends(get_db)
):
    exemption = db.query(models.Exemption).filter(models.Exemption.id == exemption_id).first()
    if not exemption:
        raise HTTPException(status_code=404, detail="豁免申请不存在")
    
    try:
        updated = ReviewService.review_exemption(db, exemption_id, review_data)
    except ValueError as e:
        AuditService.create_audit_log(
            db,
            operation_type="review_failed",
            resource_type="exemption",
            resource_id=exemption_id,
            operator=review_data.reviewer,
            original_input=review_data.model_dump(),
            process_result={"error": str(e), "status": "conflict"}
        )
        raise HTTPException(status_code=409, detail=str(e))
    
    AuditService.create_audit_log(
        db,
        operation_type="review",
        resource_type="exemption",
        resource_id=exemption_id,
        operator=review_data.reviewer,
        original_input=review_data.model_dump(),
        process_result={"new_status": review_data.review_result}
    )
    
    return _enrich_exemption_response(updated)


@app.delete("/api/v1/exemptions/{exemption_id}", response_model=schemas.ExemptionResponse, tags=["豁免申请"])
def withdraw_exemption(
    exemption_id: int,
    operator: str,
    db: Session = Depends(get_db)
):
    exemption = db.query(models.Exemption).filter(models.Exemption.id == exemption_id).first()
    if not exemption:
        raise HTTPException(status_code=404, detail="豁免申请不存在")
    
    try:
        updated = ReviewService.withdraw_exemption(db, exemption_id, operator)
    except ValueError as e:
        AuditService.create_audit_log(
            db,
            operation_type="withdraw_failed",
            resource_type="exemption",
            resource_id=exemption_id,
            operator=operator,
            original_input=None,
            process_result={"error": str(e), "status": "conflict"}
        )
        raise HTTPException(status_code=409, detail=str(e))
    
    AuditService.create_audit_log(
        db,
        operation_type="withdraw",
        resource_type="exemption",
        resource_id=exemption_id,
        operator=operator,
        original_input=None,
        process_result={"new_status": "withdrawn"}
    )
    
    return _enrich_exemption_response(updated)


@app.get("/api/v1/audit-logs", response_model=List[schemas.AuditLogResponse], tags=["审计日志"])
def list_audit_logs(
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    operator: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return AuditService.list_audit_logs(db, resource_type, resource_id, operator, skip, limit)


@app.post("/api/v1/matrix/validate", tags=["工具"])
def validate_browser_matrix(
    browser: str,
    version: str,
    matrix: dict,
    db: Session = Depends(get_db)
):
    result = BrowserMatrixService.validate_browser_version(browser, version, matrix)
    return {"browser": browser, "version": version, "is_compatible": result}


@app.get("/api/v1/export", tags=["导出"])
def export_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    excel_data = ExportService.export_compatibility_report(db, start_date, end_date)
    
    output = io.BytesIO(excel_data)
    output.seek(0)
    
    filename = f"compatibility_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def _enrich_failure_case_response(failure: models.FailureCase, db: Session):
    exemption_status = ExemptionService.get_exemption_status(db, failure.id)
    active_exemption = ExemptionService.get_active_exemption(db, failure.id)
    
    response = schemas.FailureCaseResponse(
        id=failure.id,
        page_path=failure.page_path,
        browser_matrix=failure.browser_matrix,
        failure_cases=failure.failure_cases,
        reporter=failure.reporter,
        conclusion=failure.conclusion,
        conclusion_note=failure.conclusion_note,
        created_at=failure.created_at,
        updated_at=failure.updated_at,
        exemption_status=exemption_status,
        active_exemption={
            "id": active_exemption.id,
            "exempt_browsers": active_exemption.exempt_browsers,
            "expire_at": active_exemption.expire_at
        } if active_exemption else None
    )
    return response


def _enrich_exemption_response(exemption: models.Exemption):
    is_expired = ExemptionService.is_exemption_expired(exemption)
    response = schemas.ExemptionResponse(
        id=exemption.id,
        failure_id=exemption.failure_id,
        exemption_reason=exemption.exemption_reason,
        exempt_browsers=exemption.exempt_browsers,
        expire_at=exemption.expire_at,
        applicant=exemption.applicant,
        status=exemption.status,
        review_result=exemption.review_result,
        review_comment=exemption.review_comment,
        reviewer=exemption.reviewer,
        reviewed_at=exemption.reviewed_at,
        created_at=exemption.created_at,
        is_expired=is_expired
    )
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
