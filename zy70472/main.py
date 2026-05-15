from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn
import logging
from datetime import datetime
from typing import List, Optional

from signature import SignatureService
from models import (
    SignRequest, SignResponse, BatchSignRequest,
    BatchSignResponse, SignResult, PreviewResponse,
    AuditQueryRequest, AuditQueryResponse, ReportResponse
)
from audit import AuditManager
from reporter import Reporter


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

signature_service: SignatureService = None
audit_manager: AuditManager = None
reporter: Reporter = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global signature_service, audit_manager, reporter
    signature_service = SignatureService()
    audit_manager = AuditManager()
    reporter = Reporter(audit_manager)
    logger.info("Signature service initialized")
    yield
    logger.info("Signature service shutdown")


app = FastAPI(
    title="参数签名器服务",
    description="提供参数签名、验证、批量处理和审计功能",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health", response_model=dict)
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "signature-service"
    }


@app.post("/api/v1/sign", response_model=SignResponse)
async def sign_parameters(request: SignRequest):
    try:
        result = signature_service.sign(
            params=request.params,
            client_id=request.client_id,
            compensate_enabled=request.compensate_enabled
        )
        return SignResponse(
            success=True,
            data=result,
            signature=result["signature"],
            timestamp=result["timestamp"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/verify", response_model=dict)
async def verify_signature(params: dict, signature: str, client_id: str):
    try:
        is_valid = signature_service.verify(params, signature, client_id)
        return {
            "valid": is_valid,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/batch/preview", response_model=PreviewResponse)
async def preview_batch(request: BatchSignRequest):
    preview = signature_service.preview_batch(request.items)
    return PreviewResponse(
        total_count=preview["total_count"],
        will_success_count=preview["will_success_count"],
        will_fail_count=preview["will_fail_count"],
        estimated_duration_ms=preview["estimated_duration_ms"],
        items=preview["items"]
    )


@app.post("/api/v1/batch/sign", response_model=BatchSignResponse)
async def batch_sign(request: BatchSignRequest):
    start_time = datetime.now()
    results = signature_service.batch_sign(request.items, request.compensate_enabled)
    
    audit_manager.record_batch(
        batch_id=results["batch_id"],
        items=request.items,
        results=results,
        started_at=start_time,
        completed_at=datetime.now()
    )
    
    return BatchSignResponse(
        batch_id=results["batch_id"],
        total_count=results["total_count"],
        success_count=results["success_count"],
        fail_count=results["fail_count"],
        partial_success=results["partial_success"],
        items=results["items"],
        started_at=start_time.isoformat(),
        completed_at=datetime.now().isoformat()
    )


@app.get("/api/v1/audit/query", response_model=AuditQueryResponse)
async def query_audit(
    status: Optional[str] = None,
    batch_id: Optional[str] = None,
    client_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200)
):
    filters = {}
    if status:
        filters["status"] = status
    if batch_id:
        filters["batch_id"] = batch_id
    if client_id:
        filters["client_id"] = client_id
    
    result = audit_manager.query(filters, page, page_size)
    
    if status == "failed":
        result["items"] = audit_manager.group_by_failure_reason(result["items"])
    
    return AuditQueryResponse(
        total=result["total"],
        page=page,
        page_size=page_size,
        items=result["items"],
        failure_groups=result.get("failure_groups", {})
    )


@app.get("/api/v1/report/{batch_id}", response_model=ReportResponse)
async def get_report(batch_id: str):
    report = reporter.generate_report(batch_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@app.post("/api/v1/audit/confirm")
async def confirm_audit(batch_id: str, confirmed_by: str):
    success = audit_manager.mark_confirmed(batch_id, confirmed_by)
    if not success:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"status": "confirmed", "batch_id": batch_id, "confirmed_by": confirmed_by}


@app.get("/api/v1/self-check")
async def self_check():
    results = signature_service.self_check()
    return {
        "timestamp": datetime.now().isoformat(),
        "results": results,
        "all_passed": all(r["passed"] for r in results)
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error_code": "INTERNAL_ERROR",
            "message": str(exc),
            "timestamp": datetime.now().isoformat()
        }
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
