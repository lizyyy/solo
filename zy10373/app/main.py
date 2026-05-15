from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import engine, Base, get_db
from app.models import ExportStatus
from app.schemas import (
    ExportRequestCreate,
    ExportRequestResponse,
    WatermarkGenerateRequest,
    WatermarkResponse,
    FieldAuthorizationRequest,
    FieldAuthorizationResponse,
    StatusUpdateRequest,
    DownloadSignatureRequest,
    DownloadSignatureResponse,
    AuditLogResponse,
    ExportHistoryQuery,
    ErrorResponse,
    SuccessResponse
)
from app.crud import CRUDOperations
from app.core.auth import FieldAuthorizer

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="数据导出水印API",
    description="统一数据导出、水印生成、授权管理、签名验证和追溯查询的后端API",
    version="1.0.0"
)


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    error_response = ErrorResponse(
        error_code="INTERNAL_ERROR",
        error_message=str(exc),
        timestamp=datetime.now()
    )
    return JSONResponse(
        status_code=500,
        content=error_response.model_dump(mode="json")
    )


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    error_response = ErrorResponse(
        error_code="VALIDATION_ERROR",
        error_message=str(exc),
        timestamp=datetime.now()
    )
    return JSONResponse(
        status_code=400,
        content=error_response.model_dump(mode="json")
    )


@app.post("/api/v1/exports", response_model=SuccessResponse, summary="创建导出申请")
async def create_export(
    request: ExportRequestCreate,
    x_idempotency_key: str = Header(..., description="幂等性键值"),
    db: Session = Depends(get_db)
):
    crud = CRUDOperations(db)
    authorizer = FieldAuthorizer(db)
    
    try:
        cached_response = crud.check_idempotency(x_idempotency_key, request.model_dump())
        if cached_response:
            return SuccessResponse(
                code="SUCCESS",
                message="请求已处理（幂等返回）",
                data=cached_response,
                timestamp=datetime.now()
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    existing = crud.get_export_request(request.request_id)
    if existing:
        response_data = ExportRequestResponse.model_validate(existing).model_dump()
        crud.save_idempotent_response(x_idempotency_key, request.model_dump(), response_data)
        return SuccessResponse(
            code="SUCCESS",
            message="导出申请已存在",
            data=response_data,
            timestamp=datetime.now()
        )
    
    unauthorized_fields = []
    for scope in request.field_scope:
        for field in scope.fields:
            if not authorizer.check_authorization(
                request.requester_id,
                request.data_source,
                field
            ):
                unauthorized_fields.append(f"{scope.table_name}.{field}")
    
    if unauthorized_fields:
        raise HTTPException(
            status_code=403,
            detail=f"以下字段未授权: {', '.join(unauthorized_fields)}"
        )
    
    export_request = crud.create_export_request(request)
    response_data = ExportRequestResponse.model_validate(export_request).model_dump()
    
    crud.save_idempotent_response(x_idempotency_key, request.model_dump(), response_data)
    
    return SuccessResponse(
        code="SUCCESS",
        message="导出申请创建成功",
        data=response_data,
        timestamp=datetime.now()
    )


@app.get("/api/v1/exports/{request_id}", response_model=SuccessResponse, summary="查询导出申请")
async def get_export(request_id: str, db: Session = Depends(get_db)):
    crud = CRUDOperations(db)
    export_request = crud.get_export_request(request_id)
    
    if not export_request:
        raise HTTPException(
            status_code=404,
            detail=f"Export request {request_id} not found"
        )
    
    return SuccessResponse(
        code="SUCCESS",
        message="查询成功",
        data=ExportRequestResponse.model_validate(export_request).model_dump(),
        timestamp=datetime.now()
    )


@app.put("/api/v1/exports/status", response_model=SuccessResponse, summary="更新导出申请状态")
async def update_export_status(request: StatusUpdateRequest, db: Session = Depends(get_db)):
    crud = CRUDOperations(db)
    
    try:
        export_request = crud.update_status(
            request.request_id,
            request.new_status,
            request.operator_id,
            request.operator_name,
            request.remark
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return SuccessResponse(
        code="SUCCESS",
        message="状态更新成功",
        data=ExportRequestResponse.model_validate(export_request).model_dump(),
        timestamp=datetime.now()
    )


@app.post("/api/v1/exports/watermark", response_model=SuccessResponse, summary="生成水印")
async def generate_watermark(request: WatermarkGenerateRequest, db: Session = Depends(get_db)):
    crud = CRUDOperations(db)
    
    try:
        watermark = crud.generate_watermark(request, request.request_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return SuccessResponse(
        code="SUCCESS",
        message="水印生成成功",
        data=WatermarkResponse.model_validate(watermark).model_dump(),
        timestamp=datetime.now()
    )


@app.post("/api/v1/auth/fields", response_model=SuccessResponse, summary="授权字段")
async def authorize_field(request: FieldAuthorizationRequest, db: Session = Depends(get_db)):
    authorizer = FieldAuthorizer(db)
    
    auth = authorizer.authorize_field(
        request.requester_id,
        request.data_source,
        request.field_name,
        "SYSTEM"
    )
    
    return SuccessResponse(
        code="SUCCESS",
        message="字段授权成功",
        data=FieldAuthorizationResponse.model_validate(auth).model_dump(),
        timestamp=datetime.now()
    )


@app.get("/api/v1/auth/fields/check", response_model=SuccessResponse, summary="检查字段授权")
async def check_field_authorization(
    requester_id: str,
    data_source: str,
    field_name: str,
    db: Session = Depends(get_db)
):
    authorizer = FieldAuthorizer(db)
    is_authorized = authorizer.check_authorization(requester_id, data_source, field_name)
    
    return SuccessResponse(
        code="SUCCESS",
        message="授权检查完成",
        data={"is_authorized": is_authorized},
        timestamp=datetime.now()
    )


@app.post("/api/v1/exports/signature", response_model=SuccessResponse, summary="生成下载签名")
async def generate_download_signature(request: DownloadSignatureRequest, db: Session = Depends(get_db)):
    crud = CRUDOperations(db)
    
    try:
        signature_result = crud.generate_download_signature(
            request.request_id,
            request.downloader_id,
            request.downloader_name
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    response_data = DownloadSignatureResponse(
        request_id=request.request_id,
        signature=signature_result["signature"],
        expires_at=signature_result["expires_at"],
        download_url=signature_result["download_url"]
    )
    
    return SuccessResponse(
        code="SUCCESS",
        message="下载签名生成成功",
        data=response_data.model_dump(),
        timestamp=datetime.now()
    )


@app.get("/api/v1/exports/{request_id}/audit-logs", response_model=SuccessResponse, summary="查询审计日志")
async def get_audit_logs(request_id: str, db: Session = Depends(get_db)):
    crud = CRUDOperations(db)
    logs = crud.get_audit_logs(request_id)
    
    log_responses = [AuditLogResponse.model_validate(log).model_dump() for log in logs]
    
    return SuccessResponse(
        code="SUCCESS",
        message="审计日志查询成功",
        data=log_responses,
        timestamp=datetime.now()
    )


@app.post("/api/v1/exports/history", response_model=SuccessResponse, summary="查询导出历史")
async def query_export_history(query: ExportHistoryQuery, db: Session = Depends(get_db)):
    crud = CRUDOperations(db)
    
    requests, total = crud.query_export_history(
        requester_id=query.requester_id,
        status=query.status,
        start_time=query.start_time,
        end_time=query.end_time,
        page=query.page,
        page_size=query.page_size
    )
    
    request_responses = [
        ExportRequestResponse.model_validate(req).model_dump()
        for req in requests
    ]
    
    return SuccessResponse(
        code="SUCCESS",
        message="历史查询成功",
        data={
            "items": request_responses,
            "total": total,
            "page": query.page,
            "page_size": query.page_size
        },
        timestamp=datetime.now()
    )


@app.get("/api/v1/health", summary="健康检查")
async def health_check():
    return SuccessResponse(
        code="HEALTHY",
        message="服务运行正常",
        data={"timestamp": datetime.now().isoformat()},
        timestamp=datetime.now()
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
