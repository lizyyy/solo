from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.schemas import ApiResponse, ConflictCheckResult, RiskStatistics
from app.services.conflict_checker import ConflictCheckService, ConflictType
from app.services.query_export_service import RiskQueryService
from app.models import ConstructionPlan

router = APIRouter(prefix="/check", tags=["冲突检查"])

@router.post("/plan/{plan_id}", response_model=ConflictCheckResult)
async def check_single_plan(
    plan_id: int = Path(..., description="计划ID"),
    operator: Optional[str] = Query("system", description="操作人"),
    auto_save: bool = Query(True, description="是否自动保存冲突结果"),
    db: Session = Depends(get_db)
):
    """对单个计划执行完整冲突检查"""
    plan = db.query(ConstructionPlan).filter(
        ConstructionPlan.id == plan_id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail=f"计划不存在: {plan_id}")
    
    try:
        result = ConflictCheckService.run_full_check(
            db, plan, operator, auto_save
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"冲突检查失败: {str(e)}")

@router.post("/batch", response_model=ApiResponse)
async def check_multiple_plans(
    plan_ids: List[int],
    operator: Optional[str] = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    """批量执行冲突检查"""
    try:
        results = ConflictCheckService.run_batch_check(
            db, plan_ids, operator
        )
        
        total_plans = len(results)
        with_conflicts = len([r for r in results if r.get('total_conflicts', 0) > 0])
        can_approve = len([r for r in results if r.get('can_approve', False)])
        
        return ApiResponse(
            success=True,
            message=f"批量检查完成：共 {total_plans} 个计划，"
                   f"{with_conflicts} 个存在冲突，{can_approve} 个可审签",
            data={
                "total": total_plans,
                "with_conflicts": with_conflicts,
                "can_approve": can_approve,
                "results": results
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量检查失败: {str(e)}")

@router.post("/all", response_model=ApiResponse)
async def check_all_plans(
    operator: Optional[str] = Query("system", description="操作人"),
    db: Session = Depends(get_db)
):
    """检查所有未撤销的计划"""
    try:
        results = ConflictCheckService.run_batch_check(
            db, None, operator
        )
        
        total_plans = len(results)
        with_conflicts = len([r for r in results if r.get('total_conflicts', 0) > 0])
        can_approve = len([r for r in results if r.get('can_approve', False)])
        
        return ApiResponse(
            success=True,
            message=f"全量检查完成：共 {total_plans} 个计划，"
                   f"{with_conflicts} 个存在冲突，{can_approve} 个可审签",
            data={
                "total": total_plans,
                "with_conflicts": with_conflicts,
                "can_approve": can_approve,
                "results": results
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"全量检查失败: {str(e)}")

@router.get("/plan/{plan_id}/conflicts", response_model=ApiResponse)
async def get_plan_conflicts(
    plan_id: int = Path(..., description="计划ID"),
    include_resolved: bool = Query(False, description="是否包含已解决的冲突"),
    db: Session = Depends(get_db)
):
    """获取指定计划的冲突记录"""
    try:
        conflicts = ConflictCheckService.get_conflicts_by_plan(
            db, plan_id, include_resolved
        )
        
        return ApiResponse(
            success=True,
            message=f"共 {len(conflicts)} 条冲突记录",
            data={
                "plan_id": plan_id,
                "total": len(conflicts),
                "include_resolved": include_resolved,
                "conflicts": [
                    {
                        "id": c.id,
                        "conflict_type": c.conflict_type.value,
                        "description": c.description,
                        "risk_level": c.risk_level,
                        "is_resolved": c.is_resolved,
                        "resolved_by": c.resolved_by,
                        "resolution_notes": c.resolution_notes,
                        "check_time": c.check_time.isoformat() if c.check_time else None,
                        "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None
                    }
                    for c in conflicts
                ]
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取冲突记录失败: {str(e)}")

@router.post("/resolve/{conflict_id}", response_model=ApiResponse)
async def resolve_conflict(
    conflict_id: int = Path(..., description="冲突记录ID"),
    resolved_by: str = Query(..., description="解决人"),
    resolution_notes: str = Query(..., description="解决说明"),
    db: Session = Depends(get_db)
):
    """标记冲突为已解决"""
    try:
        conflict = ConflictCheckService.resolve_conflict(
            db, conflict_id, resolved_by, resolution_notes
        )
        
        return ApiResponse(
            success=True,
            message="冲突已标记为已解决",
            data={
                "conflict_id": conflict.id,
                "plan_id": conflict.plan_id,
                "conflict_type": conflict.conflict_type.value,
                "is_resolved": conflict.is_resolved,
                "resolved_by": conflict.resolved_by,
                "resolution_notes": conflict.resolution_notes,
                "resolved_at": conflict.resolved_at.isoformat() if conflict.resolved_at else None
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解决冲突失败: {str(e)}")

@router.get("/statistics", response_model=RiskStatistics)
async def get_risk_statistics(
    start_date: Optional[str] = Query(None, description="开始日期，格式：YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期，格式：YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    """获取风险统计信息"""
    try:
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        stats = RiskQueryService.get_risk_statistics(db, start_dt, end_dt)
        return stats
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"日期格式错误: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")

@router.get("/by-risk", response_model=ApiResponse)
async def get_conflicts_by_risk(
    risk_level: Optional[str] = Query(None, description="风险等级：严重/高风险/中风险/低风险"),
    conflict_type: Optional[str] = Query(None, description="冲突类型"),
    is_resolved: bool = Query(False, description="是否已解决"),
    start_date: Optional[str] = Query(None, description="开始日期"),
    end_date: Optional[str] = Query(None, description="结束日期"),
    offset: int = Query(0, ge=0, description="偏移量"),
    limit: int = Query(100, ge=1, le=1000, description="每页数量"),
    db: Session = Depends(get_db)
):
    """按风险等级查询冲突记录"""
    try:
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        result = RiskQueryService.get_conflicts_by_risk(
            db, risk_level, conflict_type, is_resolved,
            start_dt, end_dt, offset, limit
        )
        
        return ApiResponse(
            success=True,
            message=f"共 {result['total']} 条记录",
            data=result
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")
