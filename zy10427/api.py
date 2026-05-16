from dataclasses import asdict
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from models import EvacuationStatus, ExecutionResult
from service import (
    create_evacuation_plan, review_plan, advance_step,
    handle_exception, manual_correct, generate_execution_summary,
    list_all_plans, get_plan_details
)
from storage import get_plan

app = FastAPI(title="区域流量撤离API", version="1.0.0")


class TenantBindingRequest(BaseModel):
    tenant_id: str
    tenant_name: str
    local_resources: List[str] = Field(default_factory=list)
    traffic_percentage: float = 100.0


class LocalDependencyRequest(BaseModel):
    resource_type: str
    resource_name: str
    is_critical: bool = True
    check_status: str = "PENDING"
    detail: Optional[str] = None


class CreatePlanRequest(BaseModel):
    region_name: str
    created_by: str
    tenant_bindings: List[TenantBindingRequest]
    local_dependencies: List[LocalDependencyRequest] = Field(default_factory=list)
    target_percentage: float = 0.0


class ReviewPlanRequest(BaseModel):
    operator: str
    approved: bool
    reason: str = ""


class AdvanceStepRequest(BaseModel):
    operator: str
    force: bool = False


class HandleExceptionRequest(BaseModel):
    operator: str
    exception_type: str
    exception_detail: str
    compensate: bool = False


class TenantCorrection(BaseModel):
    tenant_id: str
    passed: bool = True
    reason: Optional[str] = None


class DependencyCorrection(BaseModel):
    resource_type: str
    resource_name: str
    check_status: str = "PASS"
    detail: Optional[str] = None


class ManualCorrectRequest(BaseModel):
    operator: str
    target_traffic_percentage: Optional[float] = None
    status: Optional[str] = None
    block_reason: Optional[str] = None
    tenant_dependencies: List[TenantCorrection] = Field(default_factory=list)
    local_dependencies: List[DependencyCorrection] = Field(default_factory=list)


class ApiResponse(BaseModel):
    success: bool
    result_type: str
    message: str
    data: Optional[Dict[str, Any]] = None


def plan_to_response_dict(plan) -> Dict[str, Any]:
    return {
        "plan_id": plan.plan_id,
        "region_name": plan.region_name,
        "created_at": plan.created_at,
        "created_by": plan.created_by,
        "status": plan.status.value if isinstance(plan.status, EvacuationStatus) else plan.status,
        "overall_traffic_percentage": plan.overall_traffic_percentage,
        "current_step_index": plan.current_step_index,
        "total_steps": len(plan.evacuation_steps),
        "block_reason": plan.block_reason,
        "updated_at": plan.updated_at,
        "completed_at": plan.completed_at,
        "tenant_bindings": [asdict(t) for t in plan.tenant_bindings],
        "local_dependencies": [asdict(d) for d in plan.local_dependencies],
        "evacuation_steps": [asdict(s) for s in plan.evacuation_steps],
        "execution_logs_count": len(plan.execution_logs)
    }


@app.post("/api/v1/plans", response_model=ApiResponse, summary="创建撤离计划")
async def api_create_plan(request: CreatePlanRequest):
    tenant_dicts = [t.dict() for t in request.tenant_bindings]
    dep_dicts = [d.dict() for d in request.local_dependencies]
    
    plan, result, msg = create_evacuation_plan(
        region_name=request.region_name,
        created_by=request.created_by,
        tenant_bindings=tenant_dicts,
        local_dependencies=dep_dicts,
        target_percentage=request.target_percentage
    )
    
    return ApiResponse(
        success=result == ExecutionResult.SUCCESS,
        result_type=result.value,
        message=msg,
        data=plan_to_response_dict(plan) if plan else None
    )


@app.get("/api/v1/plans", response_model=ApiResponse, summary="查询所有撤离计划")
async def api_list_plans(region: Optional[str] = Query(None, description="按区域名称筛选")):
    plans = list_all_plans()
    if region:
        plans = [p for p in plans if p.region_name == region]
    
    plan_list = [plan_to_response_dict(p) for p in plans]
    return ApiResponse(
        success=True,
        result_type=ExecutionResult.SUCCESS.value,
        message=f"查询到{len(plan_list)}个撤离计划",
        data={"plans": plan_list, "total": len(plan_list)}
    )


@app.get("/api/v1/plans/{plan_id}", response_model=ApiResponse, summary="查询单个撤离计划详情")
async def api_get_plan(plan_id: str):
    plan = get_plan_details(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    
    data = plan_to_response_dict(plan)
    data["execution_logs"] = [asdict(log) for log in plan.execution_logs]
    
    return ApiResponse(
        success=True,
        result_type=ExecutionResult.SUCCESS.value,
        message="查询成功",
        data=data
    )


@app.post("/api/v1/plans/{plan_id}/review", response_model=ApiResponse, summary="复核撤离计划")
async def api_review_plan(plan_id: str, request: ReviewPlanRequest):
    plan, result, msg = review_plan(
        plan_id=plan_id,
        operator=request.operator,
        approved=request.approved,
        reason=request.reason
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail=msg)
    
    return ApiResponse(
        success=result == ExecutionResult.SUCCESS,
        result_type=result.value,
        message=msg,
        data=plan_to_response_dict(plan)
    )


@app.post("/api/v1/plans/{plan_id}/advance", response_model=ApiResponse, summary="推进撤离步骤")
async def api_advance_step(plan_id: str, request: AdvanceStepRequest):
    plan, result, msg = advance_step(
        plan_id=plan_id,
        operator=request.operator,
        force=request.force
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail=msg)
    
    return ApiResponse(
        success=result == ExecutionResult.SUCCESS,
        result_type=result.value,
        message=msg,
        data=plan_to_response_dict(plan)
    )


@app.post("/api/v1/plans/{plan_id}/exception", response_model=ApiResponse, summary="异常处理")
async def api_handle_exception(plan_id: str, request: HandleExceptionRequest):
    plan, result, msg = handle_exception(
        plan_id=plan_id,
        operator=request.operator,
        exception_type=request.exception_type,
        exception_detail=request.exception_detail,
        compensate=request.compensate
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail=msg)
    
    return ApiResponse(
        success=result in [ExecutionResult.SUCCESS, ExecutionResult.COMPENSATED],
        result_type=result.value,
        message=msg,
        data=plan_to_response_dict(plan)
    )


@app.post("/api/v1/plans/{plan_id}/correct", response_model=ApiResponse, summary="人工修正")
async def api_manual_correct(plan_id: str, request: ManualCorrectRequest):
    corrections = request.dict(exclude_unset=True)
    
    plan, result, msg = manual_correct(
        plan_id=plan_id,
        operator=request.operator,
        corrections=corrections
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail=msg)
    
    return ApiResponse(
        success=result == ExecutionResult.SUCCESS,
        result_type=result.value,
        message=msg,
        data=plan_to_response_dict(plan)
    )


@app.get("/api/v1/plans/{plan_id}/summary", response_model=ApiResponse, summary="导出执行摘要")
async def api_get_summary(plan_id: str):
    summary, result, msg = generate_execution_summary(plan_id)
    
    if not summary:
        raise HTTPException(status_code=404, detail=msg)
    
    return ApiResponse(
        success=result == ExecutionResult.SUCCESS,
        result_type=result.value,
        message=msg,
        data=asdict(summary)
    )


@app.get("/api/v1/plans/{plan_id}/logs", response_model=ApiResponse, summary="查询执行日志")
async def api_get_logs(plan_id: str):
    plan = get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    
    logs = [asdict(log) for log in plan.execution_logs]
    return ApiResponse(
        success=True,
        result_type=ExecutionResult.SUCCESS.value,
        message=f"查询到{len(logs)}条日志",
        data={"logs": logs, "total": len(logs)}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
