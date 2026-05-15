import json
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db, Base, engine
from app.models import MainTask, SubTask, TempResource, TaskStatus
from app.schemas import (
    MainTaskCreate, MainTaskResponse,
    SubTaskCreate, SubTaskResponse,
    TempResourceCreate, TempResourceResponse,
    TaskCancelRequest, TaskDetailResponse,
    PropagationProgressResponse, ErrorResponse,
    CancelReasonResponse, CleanupResultResponse
)
from app.cancel_engine import CancelPropagationEngine

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="任务取消传播 API",
    description="主任务取消传播、子任务中止、资源清理、通知抑制的后端服务",
    version="1.0.0"
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    error_response = ErrorResponse(
        error_code=f"HTTP_{exc.status_code}",
        error_message=exc.detail,
        timestamp=datetime.utcnow()
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.model_dump()
    )


@app.post("/tasks/", response_model=MainTaskResponse, summary="创建主任务")
def create_main_task(task: MainTaskCreate, db: Session = Depends(get_db)):
    existing = db.query(MainTask).filter(MainTask.task_id == task.task_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Task ID {task.task_id} already exists")
    
    db_task = MainTask(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@app.post("/tasks/{task_id}/sub-tasks/", response_model=SubTaskResponse, summary="添加子任务")
def add_sub_task(task_id: str, sub_task: SubTaskCreate, db: Session = Depends(get_db)):
    main_task = db.query(MainTask).filter(MainTask.task_id == task_id).first()
    if not main_task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    existing = db.query(SubTask).filter(SubTask.sub_task_id == sub_task.sub_task_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"SubTask ID {sub_task.sub_task_id} already exists")
    
    db_sub_task = SubTask(**sub_task.model_dump(), main_task_id=main_task.id)
    db.add(db_sub_task)
    db.commit()
    db.refresh(db_sub_task)
    return db_sub_task


@app.post("/sub-tasks/{sub_task_id}/resources/", response_model=TempResourceResponse, summary="添加临时资源")
def add_temp_resource(sub_task_id: str, resource: TempResourceCreate, db: Session = Depends(get_db)):
    sub_task = db.query(SubTask).filter(SubTask.sub_task_id == sub_task_id).first()
    if not sub_task:
        raise HTTPException(status_code=404, detail=f"SubTask {sub_task_id} not found")
    
    existing = db.query(TempResource).filter(TempResource.resource_id == resource.resource_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Resource ID {resource.resource_id} already exists")
    
    db_resource = TempResource(**resource.model_dump(), sub_task_id=sub_task.id)
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    return db_resource


@app.post("/tasks/cancel", summary="发起任务取消")
def cancel_task(request: TaskCancelRequest, db: Session = Depends(get_db)):
    engine = CancelPropagationEngine(db)
    
    if request.idempotency_key:
        cached = engine.check_idempotency("/tasks/cancel", request.idempotency_key)
        if cached:
            return json.loads(cached)
    
    result = engine.initiate_cancel(
        task_id=request.task_id,
        reason_code=request.reason_code,
        reason_message=request.reason_message,
        triggered_by=request.triggered_by,
        suppress_notification=request.suppress_notification
    )
    
    if not result.get("success") and "valid" in result and not result["valid"]:
        raise HTTPException(status_code=400, detail=result.get("error_message", "Cancel initiation failed"))
    
    if request.idempotency_key:
        engine.store_idempotent_result("/tasks/cancel", request.idempotency_key, json.dumps(result))
    
    return result


@app.post("/tasks/{task_id}/propagate", summary="执行取消传播")
def propagate_cancel(
    task_id: str,
    fail_at_index: Optional[int] = Query(None, description="模拟失败的子任务索引"),
    db: Session = Depends(get_db)
):
    engine = CancelPropagationEngine(db)
    result = engine.propagate_cancel(task_id, fail_sub_task_index=fail_at_index)
    
    if not result.get("success") and result.get("error_code"):
        status_code = 404 if result["error_code"] == "TASK_NOT_FOUND" else 400
        raise HTTPException(status_code=status_code, detail=result.get("error_message", "Propagation failed"))
    
    return result


@app.get("/tasks/{task_id}/progress", response_model=PropagationProgressResponse, summary="查询传播进度")
def get_progress(task_id: str, db: Session = Depends(get_db)):
    engine = CancelPropagationEngine(db)
    result = engine.get_propagation_progress(task_id)
    
    if not result.get("success"):
        status_code = 404 if result.get("error_code") == "TASK_NOT_FOUND" else 400
        raise HTTPException(status_code=status_code, detail=result.get("error_message", "Failed to get progress"))
    
    return result


@app.get("/tasks/{task_id}", response_model=TaskDetailResponse, summary="查询任务详情")
def get_task_detail(task_id: str, db: Session = Depends(get_db)):
    main_task = db.query(MainTask).filter(MainTask.task_id == task_id).first()
    if not main_task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    return TaskDetailResponse(
        main_task=main_task,
        sub_tasks=main_task.sub_tasks,
        cancel_reason=main_task.cancel_reason,
        propagation=main_task.propagation
    )


@app.get("/tasks/", response_model=List[MainTaskResponse], summary="查询所有主任务")
def list_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tasks = db.query(MainTask).offset(skip).limit(limit).all()
    return tasks


@app.get("/tasks/{task_id}/cleanup-results", response_model=List[CleanupResultResponse], summary="查询清理结果")
def get_cleanup_results(task_id: str, db: Session = Depends(get_db)):
    main_task = db.query(MainTask).filter(MainTask.task_id == task_id).first()
    if not main_task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    all_results = []
    for sub_task in main_task.sub_tasks:
        all_results.extend(sub_task.cleanup_results)
    return all_results


@app.put("/tasks/{task_id}/status", response_model=MainTaskResponse, summary="更新任务状态")
def update_task_status(task_id: str, status: TaskStatus, db: Session = Depends(get_db)):
    main_task = db.query(MainTask).filter(MainTask.task_id == task_id).first()
    if not main_task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    main_task.status = status
    db.commit()
    db.refresh(main_task)
    return main_task


@app.get("/health", summary="健康检查")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}
