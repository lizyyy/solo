from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.deps import get_db
from ..schemas.cleanup_task import CleanupTaskSchema, CleanupTaskCreate
from ..schemas.common import Response
from ..services.cleanup_service import CleanupService

router = APIRouter(prefix="/cleanup", tags=["cleanup"])


@router.get("/tasks", response_model=Response[List[CleanupTaskSchema]])
def list_tasks(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    sandbox_id: int = None,
    db: Session = Depends(get_db)
):
    tasks = CleanupService.list_tasks(db, skip=skip, limit=limit, status=status, sandbox_id=sandbox_id)
    return Response(data=tasks, message="Cleanup tasks retrieved successfully")


@router.get("/tasks/{task_id}", response_model=Response[CleanupTaskSchema])
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = CleanupService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Response(data=task, message="Task retrieved successfully")


@router.post("/tasks", response_model=Response[CleanupTaskSchema])
def create_task(task_create: CleanupTaskCreate, db: Session = Depends(get_db)):
    task = CleanupService.create_task(db, task_create)
    return Response(data=task, message="Cleanup task created successfully", code=201)


@router.post("/tasks/{task_id}/execute", response_model=Response[Dict[str, Any]])
def execute_task(task_id: int, db: Session = Depends(get_db)):
    success, message = CleanupService.execute_cleanup(db, task_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return Response(data={"task_id": task_id, "status": "completed"}, message=message or "Cleanup task executed successfully")


@router.post("/rollback/batch/{batch_id}", response_model=Response[Dict[str, Any]])
def rollback_batch(batch_id: int, db: Session = Depends(get_db)):
    success, message = CleanupService.rollback_batch(db, batch_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return Response(data={"batch_id": batch_id, "status": "rolled_back"}, message=message or "Batch rolled back successfully")
