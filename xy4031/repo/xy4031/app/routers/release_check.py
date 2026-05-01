from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas import (
    ReleaseCheckRequest,
    ReleaseCheckResponse,
    ReleaseCheckResult
)
from app.services import ReleaseRulesEngine

router = APIRouter(prefix="/release-check", tags=["放行检查"])


@router.post("/", response_model=ReleaseCheckResponse)
def check_release(
    request: ReleaseCheckRequest,
    db: Session = Depends(get_db)
):
    engine = ReleaseRulesEngine(db)
    
    results = engine.batch_evaluate(
        battery_ids=request.battery_ids,
        mission_date=request.mission_date,
        min_temperature=request.min_temperature,
        expected_flights=request.expected_flights
    )
    
    return ReleaseCheckResponse(
        request_time=datetime.utcnow(),
        mission_date=request.mission_date,
        results=results
    )


@router.get("/single/{battery_id}", response_model=ReleaseCheckResult)
def check_single_battery(
    battery_id: str,
    mission_date: datetime,
    min_temperature: float = -10.0,
    expected_flights: int = 1,
    db: Session = Depends(get_db)
):
    engine = ReleaseRulesEngine(db)
    
    result = engine.evaluate_battery(
        battery_id=battery_id,
        mission_date=mission_date,
        min_temperature=min_temperature,
        expected_flights=expected_flights
    )
    
    return result
