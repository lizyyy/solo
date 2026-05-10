from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import DeliveryImpact, DeliveryImpactCreate, DeliveryImpactAnalysis
from app.services.delivery_service import DeliveryService

router = APIRouter(prefix="/api/delivery", tags=["交期影响分析"])


@router.post("/analyze", response_model=DeliveryImpactAnalysis)
def analyze_delivery_impact(
    switch_request_id: int = Query(..., description="切换申请ID"),
    original_delivery_date: datetime = Query(..., description="原交期"),
    standard_delivery_days: int = Query(7, description="标准交货天数"),
    db: Session = Depends(get_db)
):
    service = DeliveryService(db)
    return service.analyze_delivery_impact(
        switch_request_id=switch_request_id,
        original_delivery_date=original_delivery_date,
        standard_delivery_days=standard_delivery_days
    )


@router.post("", response_model=DeliveryImpact, status_code=status.HTTP_201_CREATED)
def record_delivery_impact(
    impact_data: DeliveryImpactCreate,
    db: Session = Depends(get_db)
):
    service = DeliveryService(db)
    delivery_impact = service.record_delivery_impact(impact_data)
    if not delivery_impact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="切换申请不存在"
        )
    return delivery_impact


@router.get("/switch-request/{switch_request_id}", response_model=List[DeliveryImpact])
def list_delivery_impacts(switch_request_id: int, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    return service.get_delivery_impacts(switch_request_id)


@router.get("/calculate-days")
def calculate_standard_delivery_days(
    distance_km: float = Query(..., description="运输距离（公里）"),
    product_type: str = Query(..., description="产品类型：电子产品/大型设备/易腐品/其他"),
    db: Session = Depends(get_db)
):
    service = DeliveryService(db)
    days = service.calculate_standard_delivery_days(distance_km, product_type)
    return {
        "distance_km": distance_km,
        "product_type": product_type,
        "standard_delivery_days": days
    }
