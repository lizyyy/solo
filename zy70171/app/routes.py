from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas import (
    RebuildIndexRequest, RebuildIndexResponse,
    TaskStatusResponse, RollbackRequest
)
from app.services import IndexRebuildService

router = APIRouter(prefix="/api/v1/index", tags=["index-rebuild"])


@router.post("/rebuild", response_model=RebuildIndexResponse)
def rebuild_index(
    request: RebuildIndexRequest,
    db: Session = Depends(get_db)
):
    service = IndexRebuildService(db)
    result = service.rebuild_index(request)
    
    return RebuildIndexResponse(
        task_id=request.task_id,
        status=result["task_status"],
        message=f"索引重建任务已完成，状态：{result['task_status']}"
    )


@router.get("/task/{task_id}", response_model=TaskStatusResponse)
def get_task_status(
    task_id: str,
    db: Session = Depends(get_db)
):
    service = IndexRebuildService(db)
    result = service.get_task_status(task_id)
    
    return TaskStatusResponse(
        task=result["task"],
        validations=result["validations"],
        recall_samples=result["recall_samples"],
        reports=result["reports"]
    )


@router.post("/rollback")
def rollback_task(
    request: RollbackRequest,
    db: Session = Depends(get_db)
):
    service = IndexRebuildService(db)
    
    from app.models import IndexTask
    task = db.query(IndexTask).filter(
        IndexTask.task_id == request.task_id
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    result = service.rollback_task(task, request.reason)
    
    return {
        "task_id": request.task_id,
        "success": result["success"],
        "message": result["message"]
    }
