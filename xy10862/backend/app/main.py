from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import io
import csv

from .database import get_db, engine, Base
from .models import Task, Lock, ExecutionLog, AbnormalQueue, TaskStatus, LockStatus
from .schemas import (
    TaskCreate, TaskSchema, TaskUpdate, LockSchema, ExecutionLogSchema,
    AbnormalQueueSchema, AcquireLockRequest, HeartbeatRequest, ReleaseLockRequest,
    LockAcquireResponse, ApiResponse, TaskDetailResponse, AbnormalResolveRequest
)
from .lock_service import MutexLockService

Base.metadata.create_all(bind=engine)

app = FastAPI(title="定时任务互斥锁 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "name": "定时任务互斥锁 API",
        "version": "1.0.0",
        "description": "分布式任务互斥锁管理系统，支持多实例定时任务互斥、心跳续租、超时释放、重复执行拦截"
    }


@app.post("/api/locks/acquire", response_model=LockAcquireResponse)
def acquire_lock(request: AcquireLockRequest, db: Session = Depends(get_db)):
    service = MutexLockService(db)
    success, message, lock = service.acquire_lock(
        task_name=request.task_name,
        instance_id=request.instance_id,
        execution_window_start=request.execution_window_start,
        execution_window_end=request.execution_window_end
    )
    return LockAcquireResponse(
        success=success,
        message=message,
        lock_id=lock.id if lock else None,
        task_id=lock.task_id if lock else None
    )


@app.post("/api/locks/heartbeat", response_model=ApiResponse)
def heartbeat(request: HeartbeatRequest, db: Session = Depends(get_db)):
    service = MutexLockService(db)
    success, message = service.heartbeat(request.task_name, request.instance_id)
    return ApiResponse(success=success, message=message)


@app.post("/api/locks/release", response_model=ApiResponse)
def release_lock(request: ReleaseLockRequest, db: Session = Depends(get_db)):
    service = MutexLockService(db)
    success, message = service.release_lock(
        task_name=request.task_name,
        instance_id=request.instance_id,
        success=request.success,
        result=request.result,
        error_message=request.error_message
    )
    return ApiResponse(success=success, message=message)


@app.post("/api/locks/{lock_id}/force-release", response_model=ApiResponse)
def force_release_lock(lock_id: int, reason: Optional[str] = "Manual release", db: Session = Depends(get_db)):
    service = MutexLockService(db)
    success, message = service.force_release_lock(lock_id, reason)
    return ApiResponse(success=success, message=message)


@app.get("/api/locks", response_model=List[LockSchema])
def get_locks(
    task_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Lock)
    if task_id:
        query = query.filter(Lock.task_id == task_id)
    if status:
        query = query.filter(Lock.status == status)
    return query.order_by(Lock.acquired_at.desc()).all()


@app.post("/api/tasks", response_model=TaskSchema)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    existing = db.query(Task).filter(Task.name == task.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Task with this name already exists")
    
    db_task = Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@app.get("/api/tasks", response_model=List[TaskSchema])
def get_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.created_at.desc()).all()


@app.get("/api/tasks/{task_id}", response_model=TaskDetailResponse)
def get_task_detail(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task_data = TaskSchema.model_validate(task)
    
    current_lock = db.query(Lock).filter(
        Lock.task_id == task_id,
        Lock.status == LockStatus.ACQUIRED
    ).first()
    
    recent_logs = db.query(ExecutionLog).filter(
        ExecutionLog.task_id == task_id
    ).order_by(ExecutionLog.started_at.desc()).limit(10).all()
    
    return TaskDetailResponse(
        **task_data.model_dump(),
        current_lock=LockSchema.model_validate(current_lock) if current_lock else None,
        recent_logs=[ExecutionLogSchema.model_validate(log) for log in recent_logs]
    )


@app.put("/api/tasks/{task_id}", response_model=TaskSchema)
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for key, value in task_update.model_dump(exclude_unset=True).items():
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task


@app.get("/api/execution-logs", response_model=List[ExecutionLogSchema])
def get_execution_logs(
    task_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ExecutionLog)
    if task_id:
        query = query.filter(ExecutionLog.task_id == task_id)
    if status:
        query = query.filter(ExecutionLog.status == status)
    return query.order_by(ExecutionLog.started_at.desc()).limit(limit).all()


@app.get("/api/abnormal-queue", response_model=List[AbnormalQueueSchema])
def get_abnormal_queue(
    is_resolved: Optional[bool] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AbnormalQueue).join(Task)
    
    if is_resolved is not None:
        query = query.filter(AbnormalQueue.is_resolved == is_resolved)
    if severity:
        query = query.filter(AbnormalQueue.severity == severity)
    
    results = query.order_by(AbnormalQueue.detected_at.desc()).all()
    
    response = []
    for item in results:
        item_dict = AbnormalQueueSchema.model_validate(item).model_dump()
        item_dict["task_name"] = item.task.name
        response.append(AbnormalQueueSchema(**item_dict))
    
    return response


@app.post("/api/abnormal-queue/{abnormal_id}/resolve", response_model=ApiResponse)
def resolve_abnormal(
    abnormal_id: int,
    request: AbnormalResolveRequest,
    db: Session = Depends(get_db)
):
    abnormal = db.query(AbnormalQueue).filter(AbnormalQueue.id == abnormal_id).first()
    if not abnormal:
        raise HTTPException(status_code=404, detail="Abnormal record not found")
    
    abnormal.is_resolved = True
    abnormal.resolved_at = datetime.utcnow()
    abnormal.resolution_note = request.resolution_note
    db.commit()
    
    return ApiResponse(success=True, message="Abnormal record resolved successfully")


@app.post("/api/cleanup/expired-locks", response_model=ApiResponse)
def cleanup_expired_locks(db: Session = Depends(get_db)):
    service = MutexLockService(db)
    service.cleanup_expired_locks()
    return ApiResponse(success=True, message="Expired locks cleaned up")


@app.get("/api/export/execution-logs")
def export_execution_logs(
    task_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ExecutionLog).join(Task)
    
    if task_id:
        query = query.filter(ExecutionLog.task_id == task_id)
    if start_date:
        query = query.filter(ExecutionLog.started_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(ExecutionLog.started_at <= datetime.fromisoformat(end_date))
    
    logs = query.order_by(ExecutionLog.started_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Task Name", "Instance ID", "Status", "Started At", 
        "Completed At", "Duration (s)", "Is Duplicate", "Error Message",
        "Compensation Action", "Compensation Note"
    ])
    
    for log in logs:
        writer.writerow([
            log.id,
            log.task.name,
            log.instance_id,
            log.status,
            log.started_at.isoformat() if log.started_at else "",
            log.completed_at.isoformat() if log.completed_at else "",
            log.duration_seconds or "",
            log.is_duplicate,
            log.error_message or "",
            log.compensation_action or "",
            log.compensation_note or ""
        ])
    
    from fastapi.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=execution_logs.csv"}
    )


@app.get("/api/export/abnormal-queue")
def export_abnormal_queue(
    is_resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AbnormalQueue).join(Task)
    
    if is_resolved is not None:
        query = query.filter(AbnormalQueue.is_resolved == is_resolved)
    
    abnormals = query.order_by(AbnormalQueue.detected_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Task Name", "Instance ID", "Abnormal Type", "Description",
        "Severity", "Detected At", "Is Resolved", "Resolved At", "Resolution Note"
    ])
    
    for item in abnormals:
        writer.writerow([
            item.id,
            item.task.name,
            item.instance_id,
            item.abnormal_type,
            item.description or "",
            item.severity,
            item.detected_at.isoformat() if item.detected_at else "",
            item.is_resolved,
            item.resolved_at.isoformat() if item.resolved_at else "",
            item.resolution_note or ""
        ])
    
    from fastapi.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=abnormal_queue.csv"}
    )


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    
    active_locks = db.query(Lock).filter(Lock.status == LockStatus.ACQUIRED).count()
    total_tasks = db.query(Task).count()
    active_tasks = db.query(Task).filter(Task.is_active == True).count()
    
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_executions = db.query(ExecutionLog).filter(ExecutionLog.started_at >= today_start).count()
    today_duplicates = db.query(ExecutionLog).filter(
        ExecutionLog.started_at >= today_start,
        ExecutionLog.is_duplicate == True
    ).count()
    
    unresolved_abnormals = db.query(AbnormalQueue).filter(AbnormalQueue.is_resolved == False).count()
    
    return {
        "active_locks": active_locks,
        "total_tasks": total_tasks,
        "active_tasks": active_tasks,
        "today_executions": today_executions,
        "today_duplicates": today_duplicates,
        "unresolved_abnormals": unresolved_abnormals
    }
