from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import engine, get_db, Base
from models import TaskStatus, RecoveryAction
from schemas import (
    BatchTask, BatchTaskCreate, BatchTaskUpdateStatus, BatchTaskMarkMissed,
    BatchTaskRecover, ImpactItem, ImpactItemCreate, RecoveryReport,
    ErrorResponse, BatchTaskListResponse
)
from services import TaskService
from exceptions import TaskException

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="漏跑恢复互斥补跑影响清单后端API",
    description="财务批任务漏跑恢复系统，支持任务漏跑识别、补跑互斥、状态管理、影响范围计算、恢复报告生成",
    version="1.0.0"
)


@app.exception_handler(TaskException)
async def task_exception_handler(request, exc: TaskException):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    )


@app.post("/api/tasks/", response_model=BatchTask, status_code=status.HTTP_201_CREATED)
def create_task(task_data: BatchTaskCreate, db: Session = Depends(get_db)):
    service = TaskService(db)
    return service.create_task(task_data)


@app.get("/api/tasks/{task_id}", response_model=BatchTask)
def get_task(task_id: int, db: Session = Depends(get_db)):
    service = TaskService(db)
    return service.get_task_or_404(task_id)


@app.get("/api/tasks/", response_model=BatchTaskListResponse)
def list_tasks(
    status: Optional[TaskStatus] = None,
    task_name: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    tasks, total = service.list_tasks(status, task_name, start_time, end_time, skip, limit)
    return BatchTaskListResponse(total=total, items=tasks)


@app.put("/api/tasks/{task_id}/status", response_model=BatchTask)
def update_task_status(task_id: int, status_data: BatchTaskUpdateStatus, db: Session = Depends(get_db)):
    service = TaskService(db)
    return service.update_task_status(task_id, status_data)


@app.post("/api/tasks/detect-missed", response_model=List[BatchTask])
def detect_missed_tasks(grace_minutes: int = 30, db: Session = Depends(get_db)):
    service = TaskService(db)
    return service.detect_missed_tasks(grace_minutes)


@app.put("/api/tasks/{task_id}/mark-missed", response_model=BatchTask)
def mark_task_missed(task_id: int, missed_data: BatchTaskMarkMissed, db: Session = Depends(get_db)):
    service = TaskService(db)
    return service.mark_task_missed(task_id, missed_data)


@app.put("/api/tasks/{task_id}/recover", response_model=BatchTask)
def recover_task(task_id: int, recover_data: BatchTaskRecover, db: Session = Depends(get_db)):
    service = TaskService(db)
    return service.recover_task(task_id, recover_data)


@app.post("/api/tasks/{task_id}/request-review")
def request_review(task_id: int, reason: str, db: Session = Depends(get_db)):
    service = TaskService(db)
    service.request_review(task_id, reason)


@app.get("/api/tasks/{task_id}/impact", response_model=List[ImpactItem])
def calculate_impact(task_id: int, db: Session = Depends(get_db)):
    service = TaskService(db)
    return service.calculate_impact(task_id)


@app.post("/api/tasks/{task_id}/impact", response_model=ImpactItem, status_code=status.HTTP_201_CREATED)
def add_impact_item(task_id: int, impact_data: ImpactItemCreate, db: Session = Depends(get_db)):
    service = TaskService(db)
    return service.add_impact_item(task_id, impact_data)


@app.get("/api/tasks/{task_id}/report", response_model=RecoveryReport)
def generate_recovery_report(task_id: int, db: Session = Depends(get_db)):
    service = TaskService(db)
    return service.generate_recovery_report(task_id)


@app.post("/api/tasks/bulk-import", response_model=List[BatchTask], status_code=status.HTTP_201_CREATED)
def bulk_import_tasks(tasks_data: List[BatchTaskCreate], db: Session = Depends(get_db)):
    service = TaskService(db)
    return service.bulk_import_tasks(tasks_data)


@app.get("/api/statuses/", response_model=List[str])
def get_task_statuses():
    return [s.value for s in TaskStatus]


@app.get("/api/recovery-actions/", response_model=List[str])
def get_recovery_actions():
    return [a.value for a in RecoveryAction]


@app.get("/")
def root():
    return {
        "message": "漏跑恢复互斥补跑影响清单后端API",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
