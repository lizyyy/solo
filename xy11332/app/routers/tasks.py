from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import schemas, crud

router = APIRouter()


@router.post("/", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    db_task, validation_results = crud.create_task(db, task)
    return db_task


@router.get("/{task_id}", response_model=schemas.TaskDetail)
def get_task(task_id: int, db: Session = Depends(get_db)):
    db_task = crud.get_task(db, task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return db_task


@router.get("/no/{task_no}", response_model=schemas.TaskDetail)
def get_task_by_no(task_no: str, db: Session = Depends(get_db)):
    db_task = crud.get_task_by_no(db, task_no)
    if not db_task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return db_task


@router.get("/", response_model=List[schemas.TaskDetail])
def get_tasks(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    priority: str = None,
    db: Session = Depends(get_db)
):
    return crud.get_tasks(db, skip, limit, status, priority)


@router.post("/{task_id}/assign", response_model=schemas.Task)
def assign_task(task_id: int, assign_data: schemas.TaskAssign, db: Session = Depends(get_db)):
    task, validation_results = crud.assign_task(db, task_id, assign_data.escort_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或状态不正确")
    
    if not all(r.passed for r in validation_results):
        blocking_reasons = [f"{r.rule_name}: {r.message}" for r in validation_results if not r.passed]
        raise HTTPException(
            status_code=400,
            detail={
                "message": "任务分配被拦截",
                "blocking_reasons": blocking_reasons,
                "validation_results": [r.model_dump() for r in validation_results]
            }
        )
    
    return task


@router.post("/{task_id}/accept", response_model=schemas.Task)
def accept_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.accept_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或状态不正确")
    return task


@router.post("/{task_id}/complete", response_model=schemas.Task)
def complete_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.complete_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或状态不正确")
    return task


@router.post("/{task_id}/cancel")
def cancel_task(task_id: int, cancel_data: schemas.TaskCancel, db: Session = Depends(get_db)):
    task, results, backfilled_tasks = crud.cancel_task(db, task_id, cancel_data.reason)
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或无法取消")
    
    return {
        "task": schemas.Task.model_validate(task),
        "backfilled_count": len(backfilled_tasks),
        "backfilled_tasks": [schemas.Task.model_validate(t) for t in backfilled_tasks],
        "results": [r.model_dump() for r in results]
    }


@router.post("/{task_id}/transfer")
def transfer_task(task_id: int, transfer_data: schemas.TaskTransfer, db: Session = Depends(get_db)):
    task, results = crud.transfer_task(
        db, task_id, transfer_data.new_escort_id, transfer_data.reason, "service_desk"
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if not all(r.passed for r in results):
        blocking_reasons = [f"{r.rule_name}: {r.message}" for r in results if not r.passed]
        raise HTTPException(
            status_code=400,
            detail={
                "message": "转派被拦截",
                "blocking_reasons": blocking_reasons,
                "results": [r.model_dump() for r in results]
            }
        )
    
    return {
        "task": schemas.Task.model_validate(task),
        "results": [r.model_dump() for r in results]
    }


@router.get("/{task_id}/audit-logs", response_model=List[schemas.AuditLog])
def get_task_audit_logs(task_id: int, db: Session = Depends(get_db)):
    return crud.get_task_audit_logs(db, task_id)


@router.post("/batch/create", response_model=schemas.BatchOperationResult)
def batch_create_tasks(batch_data: schemas.BatchTaskCreate, db: Session = Depends(get_db)):
    return crud.batch_create_tasks(db, batch_data.tasks)


@router.post("/batch/assign", response_model=schemas.BatchOperationResult)
def batch_assign_tasks(batch_data: schemas.BatchTaskAssign, db: Session = Depends(get_db)):
    return crud.batch_assign_tasks(db, batch_data.task_ids, batch_data.escort_id)


@router.get("/statistics/overview")
def get_statistics(db: Session = Depends(get_db)):
    return crud.get_statistics(db)