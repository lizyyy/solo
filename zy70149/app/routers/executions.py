from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.schemas import (
    ExecutionResponse, WarmupReport, PatchRequest,
    RollbackRequest, ExecutionItemResponse
)
from app.services.task_service import task_service
from app.services.orchestrator import orchestrator

router = APIRouter(prefix="/api/executions", tags=["预热执行管理"])


@router.get("/{execution_id}", response_model=ExecutionResponse, summary="获取执行详情")
def get_execution(execution_id: int, db: Session = Depends(get_db)):
    execution = task_service.get_execution(db, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    return execution


@router.get("/{execution_id}/report", response_model=WarmupReport, summary="获取预热报告")
def get_warmup_report(execution_id: int, db: Session = Depends(get_db)):
    """
    获取完整的预热报告，包括:
    - 执行状态和耗时
    - 成功/失败/跳过数量
    - 缓存命中率
    - 失败项列表
    - 命中预期不匹配项
    - 完整操作历史
    """
    report = task_service.get_warmup_report(db, execution_id)
    if not report:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    return report


@router.get("/{execution_id}/items", response_model=dict, summary="列出执行项详情")
def list_execution_items(
    execution_id: int,
    status: Optional[str] = Query(None, description="筛选状态: pending/success/failed"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    items, total = task_service.get_execution_items(db, execution_id, status, page, page_size)
    return {
        "total": total,
        "items": [ExecutionItemResponse.model_validate(i) for i in items],
        "page": page,
        "page_size": page_size
    }


@router.post("/{execution_id}/retry", summary="重试所有失败项")
async def retry_failed_items(
    execution_id: int,
    db: Session = Depends(get_db)
):
    """
    重试该执行中所有状态为 failed 的项
    适用于网络抖动、临时故障后的恢复
    """
    try:
        count = await orchestrator.retry_failed_items(execution_id)
        return {
            "message": "重试完成",
            "success_count": count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{execution_id}/patch", summary="补录指定失败项")
async def patch_items(
    execution_id: int,
    request: PatchRequest,
    db: Session = Depends(get_db)
):
    """
    补录指定的失败项（更精细的控制）
    
    - **cache_keys**: 需要补录的缓存键列表
    - **operator**: 操作人标识（可选，用于历史记录）
    """
    try:
        count = await task_service.patch_failed_items(
            db, execution_id, request.cache_keys, request.operator
        )
        return {
            "message": "补录完成",
            "success_count": count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{execution_id}/rollback", summary="撤回本次预热")
def rollback_execution(
    execution_id: int,
    request: RollbackRequest = RollbackRequest(),
    db: Session = Depends(get_db)
):
    """
    撤回本次预热操作
    
    - **target_execution_id**: 可选，指定回滚到哪个执行的版本
      - 不填: 直接删除本次预热写入的缓存
      - 填写: 仅当当前缓存值与本次写入一致时才删除
    
    **安全说明**: 撤回操作只会删除本次执行成功写入且未被覆盖的缓存，
    不会影响其他任务或后续执行写入的数据。
    """
    try:
        count = task_service.rollback_execution(
            db, execution_id, request.target_execution_id, request.operator
        )
        return {
            "message": "撤回完成",
            "processed_count": count
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
