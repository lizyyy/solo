from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import DrillTask, DrillResult, Diagnosis
from app.schemas import (
    DrillTaskCreate, DrillTaskResponse, DrillResultResponse,
    TaskStatus
)
from app.services.drill_service import DrillSimulator

router = APIRouter(prefix="/drills", tags=["Drill Tasks"])


def run_drill_task(task_id: int, db_session):
    try:
        task = db_session.query(DrillTask).filter(DrillTask.id == task_id).first()
        if task:
            simulator = DrillSimulator(db_session, task)
            simulator.run()
    except Exception as e:
        print(f"Drill task {task_id} failed: {e}")


@router.post("/", response_model=DrillTaskResponse)
def create_drill_task(
    task_data: DrillTaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    task = DrillTask(
        task_name=task_data.task_name,
        description=task_data.description,
        enable_moved_redirect=task_data.enable_moved_redirect,
        enable_ask_redirect=task_data.enable_ask_redirect,
        enable_read_write_routing=task_data.enable_read_write_routing,
        enable_replication_lag=task_data.enable_replication_lag,
        enable_sentinel_failover=task_data.enable_sentinel_failover,
        enable_client_retry=task_data.enable_client_retry,
        enable_lua_transaction_failure=task_data.enable_lua_transaction_failure,
        replication_lag_ms=task_data.replication_lag_ms,
        max_retries=task_data.max_retries,
        seed=task_data.seed,
        status=TaskStatus.pending
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    return task


@router.post("/{task_id}/run", response_model=DrillTaskResponse)
def run_drill(
    task_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    task = db.query(DrillTask).filter(DrillTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status == TaskStatus.running:
        raise HTTPException(status_code=400, detail="Task is already running")
    
    task.status = TaskStatus.running
    task.started_at = None
    task.completed_at = None
    db.commit()
    
    def run_task():
        task_local = db.query(DrillTask).filter(DrillTask.id == task_id).first()
        if task_local:
            simulator = DrillSimulator(db, task_local)
            simulator.run()
    
    background_tasks.add_task(run_task)
    
    db.refresh(task)
    return task


@router.get("/", response_model=List[DrillTaskResponse])
def list_drill_tasks(
    status: Optional[TaskStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DrillTask)
    if status:
        query = query.filter(DrillTask.status == status)
    tasks = query.order_by(DrillTask.created_at.desc()).all()
    return tasks


@router.get("/{task_id}", response_model=DrillTaskResponse)
def get_drill_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    task = db.query(DrillTask).filter(DrillTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/{task_id}/results", response_model=List[DrillResultResponse])
def get_task_results(
    task_id: int,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    task = db.query(DrillTask).filter(DrillTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    results = db.query(DrillResult).filter(
        DrillResult.task_id == task_id
    ).order_by(DrillResult.timestamp).offset(offset).limit(limit).all()
    
    return results


@router.delete("/{task_id}", response_model=dict)
def delete_drill_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    task = db.query(DrillTask).filter(DrillTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.query(DrillResult).filter(DrillResult.task_id == task_id).delete()
    db.query(Diagnosis).filter(Diagnosis.task_id == task_id).delete()
    db.delete(task)
    db.commit()
    
    return {"message": f"Task {task_id} deleted successfully"}
