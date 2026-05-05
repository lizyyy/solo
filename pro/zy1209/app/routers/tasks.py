from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TaskStatus
from ..schemas import (
    TaskCreate, TaskUpdate, TaskResponse, TaskListResponse,
    InputSnapshotCreate, InputSnapshotResponse,
    APIResponse, PaginatedResponse
)
from ..services import TaskService

router = APIRouter()


@router.post("", response_model=APIResponse[TaskResponse], status_code=status.HTTP_201_CREATED)
def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    task = task_service.create_task(task_data)
    
    return APIResponse(
        data=TaskResponse.model_validate(task),
        message="任务创建成功"
    )


@router.get("", response_model=APIResponse[PaginatedResponse[TaskListResponse]])
def list_tasks(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status_filter: Optional[TaskStatus] = Query(None, alias="status", description="状态过滤"),
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    skip = (page - 1) * page_size
    tasks, total = task_service.list_tasks(skip=skip, limit=page_size, status=status_filter)
    
    total_pages = (total + page_size - 1) // page_size
    
    return APIResponse(
        data=PaginatedResponse(
            items=[TaskListResponse.model_validate(t) for t in tasks],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    )


@router.get("/{task_id}", response_model=APIResponse[TaskResponse])
def get_task(
    task_id: int = Path(..., ge=1, description="任务ID"),
    include_results: bool = Query(False, description="是否包含诊断结果"),
    include_exports: bool = Query(False, description="是否包含导出记录"),
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    task = task_service.get_task(task_id)
    
    response_data = TaskResponse.model_validate(task)
    
    if include_results:
        from ..services import AnalysisService
        analysis_service = AnalysisService(db)
        try:
            results = analysis_service.get_task_results(task_id)
            from ..schemas import DiagnosisResultResponse
            response_data.results = [DiagnosisResultResponse.model_validate(r) for r in results]
        except Exception:
            pass
    
    if include_exports:
        from ..services import ExportService
        export_service = ExportService(db)
        exports = export_service.get_task_exports(task_id)
        from ..schemas import ExportRecordResponse
        response_data.export_records = [ExportRecordResponse.model_validate(e) for e in exports]
    
    return APIResponse(data=response_data)


@router.put("/{task_id}", response_model=APIResponse[TaskResponse])
def update_task(
    task_id: int = Path(..., ge=1, description="任务ID"),
    task_data: TaskUpdate = ...,
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    task = task_service.update_task(task_id, task_data)
    
    return APIResponse(
        data=TaskResponse.model_validate(task),
        message="任务更新成功"
    )


@router.delete("/{task_id}", response_model=APIResponse[dict])
def delete_task(
    task_id: int = Path(..., ge=1, description="任务ID"),
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    task_service.delete_task(task_id)
    
    return APIResponse(
        data={"deleted": True},
        message="任务删除成功"
    )


@router.post("/{task_id}/snapshots", response_model=APIResponse[InputSnapshotResponse], status_code=status.HTTP_201_CREATED)
def add_snapshot(
    task_id: int = Path(..., ge=1, description="任务ID"),
    snapshot_data: InputSnapshotCreate = ...,
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    snapshot = task_service.add_snapshot(task_id, snapshot_data)
    
    return APIResponse(
        data=InputSnapshotResponse.model_validate(snapshot),
        message="快照添加成功"
    )


@router.get("/{task_id}/snapshots", response_model=APIResponse[List[InputSnapshotResponse]])
def get_snapshots(
    task_id: int = Path(..., ge=1, description="任务ID"),
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    snapshots = task_service.get_snapshots(task_id)
    
    return APIResponse(
        data=[InputSnapshotResponse.model_validate(s) for s in snapshots]
    )


@router.get("/{task_id}/summary", response_model=APIResponse[dict])
def get_task_summary(
    task_id: int = Path(..., ge=1, description="任务ID"),
    db: Session = Depends(get_db)
):
    from ..services import AnalysisService
    analysis_service = AnalysisService(db)
    summary = analysis_service.get_task_summary(task_id)
    
    return APIResponse(data=summary)
