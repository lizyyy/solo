from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from .database import get_db
from .schemas import (
    TaskCreate, TaskRegister, TaskArchive, TaskRevoke,
    TaskResponse, TaskDetailResponse, TaskListResponse,
    TimelineResponse, ExportRequest, ErrorResponse
)
from .models import TaskStatus
from .crud import TaskService
from .exporter import ExportService

router = APIRouter()


@router.post("/tasks", response_model=TaskResponse, responses={400: {"model": ErrorResponse}})
def create_task(task_in: TaskCreate, db: Session = Depends(get_db)):
    """创建归档任务"""
    try:
        service = TaskService(db)
        task = service.create_task(task_in)
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"code": "TASK_EXISTS", "message": str(e)})


@router.post("/tasks/{task_number}/register", response_model=TaskResponse, responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def register_output(task_number: str, register_in: TaskRegister, db: Session = Depends(get_db)):
    """登记任务输出文件 - 重复提交相同文件不会产生脏数据"""
    try:
        service = TaskService(db)
        task = service.register_output(task_number, register_in)
        return task
    except ValueError as e:
        if "不存在" in str(e):
            raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND", "message": str(e)})
        raise HTTPException(status_code=400, detail={"code": "INVALID_STATUS", "message": str(e)})


@router.post("/tasks/{task_number}/archive", response_model=TaskResponse, responses={400: {"model": ErrorResponse}, 403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def archive_task(task_number: str, archive_in: TaskArchive, db: Session = Depends(get_db)):
    """归档任务输出"""
    try:
        service = TaskService(db)
        task = service.archive_task(task_number, archive_in)
        return task
    except ValueError as e:
        if "不存在" in str(e):
            raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND", "message": str(e)})
        raise HTTPException(status_code=400, detail={"code": "INVALID_STATUS", "message": str(e)})
    except PermissionError as e:
        raise HTTPException(status_code=403, detail={"code": "PERMISSION_DENIED", "message": str(e)})


@router.post("/tasks/{task_number}/revoke", response_model=TaskResponse, responses={400: {"model": ErrorResponse}, 403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def revoke_task(task_number: str, revoke_in: TaskRevoke, db: Session = Depends(get_db)):
    """撤销任务"""
    try:
        service = TaskService(db)
        task = service.revoke_task(task_number, revoke_in)
        return task
    except ValueError as e:
        if "不存在" in str(e):
            raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND", "message": str(e)})
        raise HTTPException(status_code=400, detail={"code": "INVALID_STATUS", "message": str(e)})
    except PermissionError as e:
        raise HTTPException(status_code=403, detail={"code": "PERMISSION_DENIED", "message": str(e)})


@router.get("/tasks/{task_number}", response_model=TaskDetailResponse, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def get_task_detail(task_number: str, operator: Optional[str] = None, db: Session = Depends(get_db)):
    """获取任务详情（含时间线、归档记录、清理记录）"""
    try:
        service = TaskService(db)
        task = service.get_task_detail(task_number, operator)
        return task
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND", "message": str(e)})
    except PermissionError as e:
        raise HTTPException(status_code=403, detail={"code": "PERMISSION_DENIED", "message": str(e)})


@router.get("/tasks", response_model=TaskListResponse)
def list_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[TaskStatus] = None,
    owner: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """查询任务列表"""
    service = TaskService(db)
    total, tasks = service.list_tasks(skip=skip, limit=limit, status=status, owner=owner)
    return {"total": total, "items": tasks}


@router.get("/tasks/{task_number}/timelines", response_model=List[TimelineResponse], responses={404: {"model": ErrorResponse}})
def get_task_timelines(task_number: str, db: Session = Depends(get_db)):
    """获取任务时间线 - 用于排查问题"""
    try:
        service = TaskService(db)
        timelines = service.get_timelines(task_number)
        return timelines
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND", "message": str(e)})


@router.post("/tasks/{task_number}/expire", response_model=TaskResponse, responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def expire_task(task_number: str, operator: Optional[str] = None, db: Session = Depends(get_db)):
    """标记任务过期"""
    try:
        service = TaskService(db)
        task = service.expire_task(task_number, operator)
        return task
    except ValueError as e:
        if "不存在" in str(e):
            raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND", "message": str(e)})
        raise HTTPException(status_code=400, detail={"code": "INVALID_STATUS", "message": str(e)})


@router.post("/tasks/{task_number}/cleanup", response_model=TaskResponse, responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def cleanup_task(task_number: str, operator: Optional[str] = None, reason: str = "manual", db: Session = Depends(get_db)):
    """清理任务文件"""
    try:
        service = TaskService(db)
        task = service.cleanup_task(task_number, operator, reason)
        return task
    except ValueError as e:
        if "不存在" in str(e):
            raise HTTPException(status_code=404, detail={"code": "TASK_NOT_FOUND", "message": str(e)})
        raise HTTPException(status_code=400, detail={"code": "INVALID_STATUS", "message": str(e)})


@router.post("/tasks/cleanup/batch", response_model=List[TaskResponse])
def batch_cleanup(operator: str = "system", db: Session = Depends(get_db)):
    """批量清理过期任务"""
    service = TaskService(db)
    tasks = service.batch_cleanup_expired(operator)
    return tasks


@router.post("/export")
def export_tasks(request: ExportRequest, db: Session = Depends(get_db)):
    """导出任务归档汇总报告（Excel格式）- 用于排查问题专用"""
    export_service = ExportService(db)
    excel_data = export_service.export_to_excel(request)
    
    filename = f"task_archive_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
