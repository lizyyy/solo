from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..schemas import StatisticsResponse
from ..services.statistics_service import StatisticsService

router = APIRouter(prefix="/api/statistics", tags=["statistics"])


@router.get("/", response_model=StatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    return StatisticsService.get_full_statistics(db)


@router.get("/basic")
def get_basic_statistics(db: Session = Depends(get_db)):
    return StatisticsService.get_basic_statistics(db)


@router.get("/daily-trend")
def get_daily_trend(days: int = 30, db: Session = Depends(get_db)):
    return StatisticsService.get_daily_trend(db, days)


@router.get("/top-skills")
def get_top_skills(top_n: int = 10, db: Session = Depends(get_db)):
    return StatisticsService.get_top_skills(db, top_n)
