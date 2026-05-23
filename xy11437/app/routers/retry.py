from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.auth import get_current_active_user, require_roles
from app import models, schemas, services

router = APIRouter(prefix="/retry-queue", tags=["重试队列"])


@router.get("", response_model=List[schemas.RetryQueueResponse])
async def list_retry_queue(
    status: Optional[models.RecordStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.RetryQueue)
    if status:
        query = query.filter(models.RetryQueue.status == status)
    items = query.order_by(models.RetryQueue.scheduled_at.asc()).offset(skip).limit(limit).all()
    return items


@router.post("/{retry_id}/execute")
async def execute_retry(
    retry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.REVIEWER,
        models.UserRole.SUPERVISOR
    ))
):
    success, message = services.execute_retry(db, retry_id, current_user.id)
    return {"success": success, "message": message}


@router.get("/pending", response_model=List[schemas.RetryQueueResponse])
async def get_pending_retries(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    now = datetime.now()
    items = db.query(models.RetryQueue).filter(
        models.RetryQueue.status == models.RecordStatus.PENDING,
        models.RetryQueue.scheduled_at <= now
    ).order_by(models.RetryQueue.scheduled_at.asc()).all()
    return items
