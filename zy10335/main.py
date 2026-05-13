from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
from datetime import datetime
from models import (
    ProxyRule, RuleStatus, RuleCreateRequest,
    ValidationRequest, ValidationResponse, ErrorResponse
)
from service import DesensitizationService


app = FastAPI(
    title="按需脱敏代理 API",
    description="数据脱敏代理服务 - 提供字段级脱敏、访问授权、审计追踪能力",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = DesensitizationService()


@app.get("/health", summary="健康检查")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/api/v1/rules", response_model=ProxyRule, summary="创建脱敏规则")
async def create_rule(
    req: RuleCreateRequest,
    x_user_id: str = Header(..., description="创建人ID")
):
    try:
        return service.create_rule(req, x_user_id)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code="CREATE_FAILED",
                message=str(e)
            ).model_dump()
        )


@app.get("/api/v1/rules", response_model=List[ProxyRule], summary="查询规则列表")
async def list_rules(status: Optional[RuleStatus] = None):
    return service.list_rules(status)


@app.get("/api/v1/rules/{rule_id}", response_model=ProxyRule, summary="查询单个规则")
async def get_rule(rule_id: str):
    rule = service.get_rule(rule_id)
    if not rule:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code="RULE_NOT_FOUND",
                message=f"规则 {rule_id} 不存在"
            ).model_dump()
        )
    return rule


@app.post("/api/v1/rules/{rule_id}/approve", response_model=ProxyRule, summary="审批规则")
async def approve_rule(
    rule_id: str,
    x_user_id: str = Header(..., description="审批人ID")
):
    rule = service.approve_rule(rule_id, x_user_id)
    if not rule:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code="RULE_NOT_FOUND",
                message=f"规则 {rule_id} 不存在"
            ).model_dump()
        )
    return rule


@app.post("/api/v1/rules/{rule_id}/suspend", response_model=ProxyRule, summary="暂停规则")
async def suspend_rule(rule_id: str):
    rule = service.suspend_rule(rule_id)
    if not rule:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code="RULE_NOT_FOUND",
                message=f"规则 {rule_id} 不存在"
            ).model_dump()
        )
    return rule


@app.post("/api/v1/validate", response_model=ValidationResponse, summary="脱敏校验")
async def validate_data(req: ValidationRequest):
    try:
        record, desensitized_data = service.process_validation(req)
        
        if desensitized_data is None:
            return ValidationResponse(
                success=True,
                rule_id=record.rule_id,
                request_id=record.request_id,
                original_digest=record.original_digest,
                desensitized_digest=record.desensitized_digest,
                desensitized_data={},
                matched_fields=record.matched_fields,
                message="重复请求，使用缓存结果"
            )
        
        return ValidationResponse(
            success=True,
            rule_id=record.rule_id,
            request_id=record.request_id,
            original_digest=record.original_digest,
            desensitized_digest=record.desensitized_digest,
            desensitized_data=desensitized_data,
            matched_fields=record.matched_fields,
            message="脱敏处理完成"
        )
        
    except ValueError as e:
        error_code, message = e.args
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=error_code,
                message=message,
                request_id=req.request_id
            ).model_dump()
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error_code="INTERNAL_ERROR",
                message=str(e),
                request_id=req.request_id
            ).model_dump()
        )


@app.get("/api/v1/records", summary="查询访问记录")
async def list_records(
    rule_id: Optional[str] = None,
    caller: Optional[str] = None
):
    return service.list_records(rule_id, caller)


@app.get("/api/v1/records/{record_id}", summary="查询单个记录")
async def get_record(record_id: str):
    record = service.get_record(record_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code="RECORD_NOT_FOUND",
                message=f"记录 {record_id} 不存在"
            ).model_dump()
        )
    return record


@app.exception_handler(422)
async def validation_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            error_code="VALIDATION_ERROR",
            message="请求参数校验失败",
            details={"errors": exc.errors()}
        ).model_dump()
    )
