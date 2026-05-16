from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from models import (
    KeyCreateRequest, KeyQueryRequest, KeyReferenceRequest,
    StatusAdvanceRequest, ManualCorrectionRequest, ExportReportRequest,
    KeyResponse, ReferenceResponse, OperationLogResponse, ReportResponse,
    KeyStatus, KeyPurpose
)
from service import KeyEscrowService
from database import init_db, get_db

app = FastAPI(title="多租户密钥托管API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


def get_service(db: Session = Depends(get_db)):
    return KeyEscrowService(db)


@app.post("/api/v1/keys", response_model=KeyResponse, tags=["密钥管理"])
async def create_key(
    request: KeyCreateRequest,
    service: KeyEscrowService = Depends(get_service)
):
    key, log = service.create_key(
        tenant_id=request.tenant_id,
        purpose=request.purpose,
        encryption_material=request.encryption_material,
        metadata=request.metadata,
        operator=request.operator
    )
    if not key:
        raise HTTPException(status_code=400, detail=log.conclusion if log else "创建失败")
    return key


@app.post("/api/v1/keys/query", response_model=List[KeyResponse], tags=["密钥管理"])
async def query_keys(
    request: KeyQueryRequest,
    service: KeyEscrowService = Depends(get_service)
):
    keys = service.query_keys(
        tenant_id=request.tenant_id,
        purpose=request.purpose,
        status=request.status,
        key_version=request.key_version
    )
    return keys


@app.post("/api/v1/keys/reference", response_model=ReferenceResponse, tags=["密钥管理"])
async def record_reference(
    request: KeyReferenceRequest,
    service: KeyEscrowService = Depends(get_service)
):
    ref, log = service.record_reference(
        tenant_id=request.tenant_id,
        key_version=request.key_version,
        data_batch_id=request.data_batch_id,
        purpose=request.purpose,
        metadata=request.metadata,
        operator=request.operator
    )
    if not ref:
        raise HTTPException(status_code=400, detail=log.conclusion if log else "引用失败")
    return ref


@app.post("/api/v1/keys/status", response_model=KeyResponse, tags=["密钥管理"])
async def advance_status(
    request: StatusAdvanceRequest,
    service: KeyEscrowService = Depends(get_service)
):
    key, log = service.advance_status(
        tenant_id=request.tenant_id,
        key_version=request.key_version,
        target_status=request.target_status,
        approved_by=request.approved_by,
        operator=request.operator,
        reason=request.reason
    )
    if not key:
        raise HTTPException(status_code=400, detail=log.conclusion if log else "状态推进失败")
    return key


@app.post("/api/v1/keys/correct", response_model=KeyResponse, tags=["密钥管理"])
async def manual_correction(
    request: ManualCorrectionRequest,
    service: KeyEscrowService = Depends(get_service)
):
    key, log = service.manual_correction(
        tenant_id=request.tenant_id,
        key_version=request.key_version,
        field_updates=request.field_updates,
        operator=request.operator,
        reason=request.reason
    )
    if not key:
        raise HTTPException(status_code=400, detail=log.conclusion if log else "人工修正失败")
    return key


@app.post("/api/v1/reports/export", response_model=ReportResponse, tags=["报告管理"])
async def export_report(
    request: ExportReportRequest,
    service: KeyEscrowService = Depends(get_service)
):
    report, content = service.export_report(
        tenant_id=request.tenant_id,
        report_type=request.report_type,
        period_start=request.period_start,
        period_end=request.period_end,
        operator=request.operator
    )
    return ReportResponse(
        report_id=report.report_id,
        tenant_id=report.tenant_id,
        report_type=report.report_type,
        generated_at=report.generated_at,
        content=content
    )


@app.get("/api/v1/logs/{tenant_id}", response_model=List[OperationLogResponse], tags=["审计日志"])
async def get_operation_logs(
    tenant_id: str,
    limit: int = 100,
    service: KeyEscrowService = Depends(get_service)
):
    logs = service.get_operation_logs(tenant_id=tenant_id, limit=limit)
    return logs


@app.get("/api/v1/references/{tenant_id}", response_model=List[ReferenceResponse], tags=["引用管理"])
async def get_key_references(
    tenant_id: str,
    key_version: str = None,
    service: KeyEscrowService = Depends(get_service)
):
    refs = service.get_key_references(tenant_id=tenant_id, key_version=key_version)
    return refs


@app.get("/health", tags=["系统"])
async def health_check():
    return {"status": "healthy", "service": "key-escrow-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
