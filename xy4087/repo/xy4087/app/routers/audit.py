from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.schemas import AuditLogResponse
from app.services.audit_service import audit_service

router = APIRouter(prefix="/datasets/{dataset_id}/audit", tags=["审计日志"])


@router.get("/logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    dataset_id: int,
    status: Optional[str] = Query(None, description="筛选状态: success, failed, rejected"),
    query_type: Optional[str] = Query(None, description="筛选查询类型: count, sum, avg, aggregate"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """获取审计日志列表"""
    logs = audit_service.get_logs(
        db=db,
        dataset_id=dataset_id,
        status=status,
        query_type=query_type,
        limit=limit,
        offset=offset
    )
    return logs


@router.get("/logs/{log_id}", response_model=AuditLogResponse)
def get_audit_log(
    dataset_id: int,
    log_id: int,
    db: Session = Depends(get_db)
):
    """获取单个审计日志详情"""
    log = audit_service.get_log_by_id(db=db, log_id=log_id)
    
    if not log:
        raise HTTPException(status_code=404, detail=f"审计日志 {log_id} 不存在")
    
    # 验证是否属于该数据集
    if log.dataset_id != dataset_id:
        raise HTTPException(status_code=404, detail=f"审计日志 {log_id} 不属于数据集 {dataset_id}")
    
    return log


@router.get("/statistics")
def get_audit_statistics(
    dataset_id: int,
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    db: Session = Depends(get_db)
):
    """获取审计统计信息"""
    stats = audit_service.get_statistics(
        db=db,
        dataset_id=dataset_id,
        start_time=start_time,
        end_time=end_time
    )
    return stats


@router.get("/logs/{log_id}/parameters")
def get_log_parameters(
    dataset_id: int,
    log_id: int,
    db: Session = Depends(get_db)
):
    """获取审计日志中的查询参数（解析后的JSON）"""
    log = audit_service.get_log_by_id(db=db, log_id=log_id)
    
    if not log:
        raise HTTPException(status_code=404, detail=f"审计日志 {log_id} 不存在")
    
    # 验证是否属于该数据集
    if log.dataset_id != dataset_id:
        raise HTTPException(status_code=404, detail=f"审计日志 {log_id} 不属于数据集 {dataset_id}")
    
    # 解析参数
    parameters = audit_service.parse_query_parameters(log)
    
    return {
        "log_id": log_id,
        "dataset_id": dataset_id,
        "query_type": log.query_type,
        "parameters": parameters,
        "created_at": log.created_at
    }
