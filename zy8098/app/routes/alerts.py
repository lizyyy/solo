from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from .. import schemas, services
from ..database import get_db

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("/expiry", response_model=List[schemas.ExpiryAlert])
def get_expiry_alerts(
    hours_threshold: float = Query(2.0, description="过期前多少小时预警"),
    db: Session = Depends(get_db)
):
    return services.AlertService.get_expiry_alerts(db, hours_threshold)
