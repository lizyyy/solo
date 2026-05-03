from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.schemas import (
    ApiResponse,
    SubmitApprovalRequest,
    ApproveRequest,
    RejectRequest,
    CancelRequest,
    ApprovalActionResponse
)
from app.services.approval_service import ApprovalService
from app.models import ConstructionPlan, ApprovalStatus

router = APIRouter(prefix="/approval", tags=["审签管理"])

@router.post("/submit", response_model=ApprovalActionResponse)
async def submit_for_approval(
    request: SubmitApprovalRequest,
    db: Session = Depends(get_db)
):
    """提交计划到待审核状态"""
    try:
        result = ApprovalService.submit_for_approval(
            db, request.plan_id, request.submitter, request.comments
        )
        
        return ApprovalActionResponse(
            success=True,
            plan_id=result["plan_id"],
            plan_no=result["plan_no"],
            status=result["status"],
            message=result["message"],
            approval_record_id=result["approval_record_id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提交失败: {str(e)}")

@router.post("/approve", response_model=ApprovalActionResponse)
async def approve_plan(
    request: ApproveRequest,
    db: Session = Depends(get_db)
):
    """审签通过计划"""
    try:
        result = ApprovalService.approve(
            db, request.plan_id, request.approver,
            request.comments, request.force_approve
        )
        
        return ApprovalActionResponse(
            success=True,
            plan_id=result["plan_id"],
            plan_no=result["plan_no"],
            status=result["status"],
            message=result["message"],
            approval_record_id=result["approval_record_id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"审签失败: {str(e)}")

@router.post("/reject", response_model=ApprovalActionResponse)
async def reject_plan(
    request: RejectRequest,
    db: Session = Depends(get_db)
):
    """驳回计划"""
    try:
        result = ApprovalService.reject(
            db, request.plan_id, request.approver, request.comments
        )
        
        return ApprovalActionResponse(
            success=True,
            plan_id=result["plan_id"],
            plan_no=result["plan_no"],
            status=result["status"],
            message=result["message"],
            approval_record_id=result["approval_record_id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"驳回失败: {str(e)}")

@router.post("/cancel", response_model=ApprovalActionResponse)
async def cancel_plan(
    request: CancelRequest,
    db: Session = Depends(get_db)
):
    """撤销已审签的计划"""
    try:
        result = ApprovalService.cancel(
            db, request.plan_id, request.operator, request.reason
        )
        
        return ApprovalActionResponse(
            success=True,
            plan_id=result["plan_id"],
            plan_no=result["plan_no"],
            status=result["status"],
            message=result["message"],
            approval_record_id=result["approval_record_id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"撤销失败: {str(e)}")

@router.get("/history/{plan_id}", response_model=ApiResponse)
async def get_approval_history(
    plan_id: int = Path(..., description="计划ID"),
    db: Session = Depends(get_db)
):
    """获取计划的审签历史"""
    try:
        history = ApprovalService.get_approval_history(db, plan_id)
        
        return ApiResponse(
            success=True,
            message=f"共 {len(history)} 条审签记录",
            data={
                "plan_id": plan_id,
                "total": len(history),
                "history": history
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取审签历史失败: {str(e)}")

@router.get("/list", response_model=ApiResponse)
async def list_plans_by_status(
    status: Optional[str] = Query(None, description="状态：草稿/待审核/已审签/已驳回/已撤销"),
    line: Optional[str] = Query(None, description="线路"),
    start_date: Optional[str] = Query(None, description="开始日期，格式：YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期，格式：YYYY-MM-DD"),
    offset: int = Query(0, ge=0, description="偏移量"),
    limit: int = Query(100, ge=1, le=1000, description="每页数量"),
    db: Session = Depends(get_db)
):
    """按状态查询计划列表"""
    try:
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        result = ApprovalService.get_plans_by_status(
            db, status, line, start_dt, end_dt, offset, limit
        )
        
        return ApiResponse(
            success=True,
            message=f"共 {result['total']} 条计划",
            data=result
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")

@router.get("/detail/{plan_id}", response_model=ApiResponse)
async def get_plan_detail(
    plan_id: int = Path(..., description="计划ID"),
    include_conflicts: bool = Query(True, description="是否包含冲突记录"),
    include_approval_history: bool = Query(True, description="是否包含审签历史"),
    db: Session = Depends(get_db)
):
    """获取计划详情"""
    try:
        detail = ApprovalService.get_plan_detail(
            db, plan_id, include_conflicts, include_approval_history
        )
        
        return ApiResponse(
            success=True,
            message="获取计划详情成功",
            data=detail
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取计划详情失败: {str(e)}")

@router.get("/statuses", response_model=ApiResponse)
async def get_all_statuses():
    """获取所有状态枚举"""
    statuses = [
        {"value": s.value, "name": s.name}
        for s in ApprovalStatus
    ]
    
    return ApiResponse(
        success=True,
        message="所有状态枚举",
        data=statuses
    )
