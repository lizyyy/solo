from typing import Generator
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EstimationTask
from ..services import TaskService


def get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


def get_task(
    task_id: int,
    db: Session = Depends(get_db_session),
) -> EstimationTask:
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 {task_id} 不存在",
        )
    return task
