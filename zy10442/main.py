from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from models import (
    ResidencyApproval, ResidencyReport, ApprovalStatus, DataType,
    Region, Tenant
)
from service import service

app = FastAPI(
    title="数据驻留审批 API",
    description="跨区域客户上线前数据驻留审批管理系统",
    version="1.0.0"
)


class CreateApprovalRequest(BaseModel):
    tenant_id: str
    target_region: str
    data_types: List[DataType]
    extra_info: Optional[Dict[str, Any]] = None


class AdvanceStatusRequest(BaseModel):
    new_status: ApprovalStatus
    reviewer: str
    comment: Optional[str] = ""


class ManualCorrectRequest(BaseModel):
    corrections: Dict[str, Any]
    reviewer: str
    comment: str


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    code: int = 200


@app.get("/", summary="API 健康检查")
async def root():
    return {
        "service": "数据驻留审批 API",
        "status": "running",
        "version": "1.0.0"
    }


@app.post("/api/v1/approvals", summary="创建审批申请", response_model=ApiResponse)
async def create_approval(request: CreateApprovalRequest):
    original_request = request.model_dump()
    
    approval, is_new = service.create_approval(
        tenant_id=request.tenant_id,
        target_region=request.target_region,
        data_types=request.data_types,
        original_request=original_request
    )
    
    if is_new:
        message = "审批申请创建成功"
    else:
        message = "幂等校验：已存在相同的审批申请，返回已有记录"
    
    return ApiResponse(
        success=True,
        message=message,
        data={
            "approval": approval,
            "is_new": is_new,
            "idempotent": not is_new
        }
    )


@app.get("/api/v1/approvals", summary="查询审批列表", response_model=ApiResponse)
async def list_approvals(
    tenant_id: Optional[str] = Query(None, description="按租户ID过滤"),
    status: Optional[str] = Query(None, description="按状态过滤")
):
    approvals = service.list_approvals(tenant_id, status)
    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "approvals": approvals,
            "total": len(approvals)
        }
    )


@app.get("/api/v1/approvals/{approval_id}", summary="查询单个审批详情", response_model=ApiResponse)
async def get_approval(approval_id: str):
    approval = service.get_approval(approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="审批记录不存在")
    
    return ApiResponse(
        success=True,
        message="查询成功",
        data={"approval": approval}
    )


@app.put("/api/v1/approvals/{approval_id}/status", summary="推进审批状态", response_model=ApiResponse)
async def advance_approval_status(approval_id: str, request: AdvanceStatusRequest):
    approval = service.advance_status(
        approval_id=approval_id,
        new_status=request.new_status,
        reviewer=request.reviewer,
        comment=request.comment
    )
    
    if not approval:
        raise HTTPException(status_code=404, detail="审批记录不存在")
    
    return ApiResponse(
        success=True,
        message=f"审批状态已更新为 {request.new_status.value}",
        data={"approval": approval}
    )


@app.put("/api/v1/approvals/{approval_id}/correct", summary="人工修正审批", response_model=ApiResponse)
async def manual_correct_approval(approval_id: str, request: ManualCorrectRequest):
    approval = service.manual_correct(
        approval_id=approval_id,
        corrections=request.corrections,
        reviewer=request.reviewer,
        comment=request.comment
    )
    
    if not approval:
        raise HTTPException(status_code=404, detail="审批记录不存在")
    
    return ApiResponse(
        success=True,
        message="人工修正成功",
        data={"approval": approval}
    )


@app.post("/api/v1/approvals/{approval_id}/report", summary="生成驻留报告", response_model=ApiResponse)
async def generate_report(approval_id: str):
    report = service.generate_report(approval_id)
    if not report:
        raise HTTPException(status_code=404, detail="审批记录不存在")
    
    return ApiResponse(
        success=True,
        message="报告生成成功",
        data={"report": report}
    )


@app.get("/api/v1/reports", summary="查询报告列表", response_model=ApiResponse)
async def list_reports(approval_id: Optional[str] = Query(None, description="按审批ID过滤")):
    reports = service.list_reports(approval_id)
    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "reports": reports,
            "total": len(reports)
        }
    )


@app.get("/api/v1/reports/{report_id}", summary="查询单个报告详情", response_model=ApiResponse)
async def get_report(report_id: str):
    report = service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    return ApiResponse(
        success=True,
        message="查询成功",
        data={"report": report}
    )


@app.get("/api/v1/regions", summary="查询区域配置列表", response_model=ApiResponse)
async def list_regions():
    from storage import store
    regions = store.list_regions()
    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "regions": regions,
            "total": len(regions)
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "code": exc.status_code
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": f"服务器内部错误: {str(exc)}",
            "code": 500
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
