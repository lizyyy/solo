from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.schemas import (
    TaskSummary, EscortPerformance, DailyTrend,
    ExceptionSummary, QueueSummary
)
from app.services import StatsService

router = APIRouter(prefix="/stats", tags=["statistics"])


@router.get("/tasks/summary", response_model=TaskSummary)
def get_task_summary(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    escort_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    service = StatsService(db)
    return service.get_task_summary(
        start_date=start_date,
        end_date=end_date,
        escort_id=escort_id,
    )


@router.get("/escorts/performance", response_model=List[EscortPerformance])
def get_escorts_performance(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    service = StatsService(db)
    return service.get_escort_performance(
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/escorts/{escort_id}/performance", response_model=List[EscortPerformance])
def get_escort_performance(
    escort_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    service = StatsService(db)
    return service.get_escort_performance(
        escort_id=escort_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/tasks/daily-trends", response_model=List[DailyTrend])
def get_daily_trends(
    days: int = 30,
    db: Session = Depends(get_db),
):
    service = StatsService(db)
    return service.get_daily_trends(days=days)


@router.get("/exceptions/summary", response_model=ExceptionSummary)
def get_exception_summary(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    service = StatsService(db)
    return service.get_exception_summary(
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/queue/summary", response_model=QueueSummary)
def get_queue_summary(db: Session = Depends(get_db)):
    service = StatsService(db)
    return service.get_queue_summary()
