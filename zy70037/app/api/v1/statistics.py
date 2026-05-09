from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.statistics import (
    ClosedLoopStats,
    ProviderPerformance,
    StorePerformance,
    StatisticsQuery,
)
from app.schemas.base import ResponseModel
from app.services.statistics_service import StatisticsService

router = APIRouter(prefix="/statistics", tags=["statistics"])


@router.get("/closed-loop", response_model=ResponseModel[ClosedLoopStats])
def get_closed_loop_stats(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    region_id: Optional[int] = Query(None),
    store_id: Optional[int] = Query(None),
    provider_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    service = StatisticsService(db)
    query_params = StatisticsQuery(
        start_time=start_time,
        end_time=end_time,
        region_id=region_id,
        store_id=store_id,
        provider_id=provider_id,
    )
    stats = service.get_closed_loop_stats(query_params)
    return ResponseModel(data=stats)


@router.get("/provider-performance", response_model=ResponseModel[List[ProviderPerformance]])
def get_provider_performance(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    service = StatisticsService(db)
    query_params = StatisticsQuery(
        start_time=start_time,
        end_time=end_time,
    )
    performance = service.get_provider_performance(query_params)
    return ResponseModel(data=performance)


@router.get("/store-performance", response_model=ResponseModel[List[StorePerformance]])
def get_store_performance(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    store_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    service = StatisticsService(db)
    query_params = StatisticsQuery(
        start_time=start_time,
        end_time=end_time,
        store_id=store_id,
    )
    performance = service.get_store_performance(query_params)
    return ResponseModel(data=performance)
