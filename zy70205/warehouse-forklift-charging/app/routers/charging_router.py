from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.models import ChargingRequest, ChargingStatus
from app.schemas.schemas import (
    ChargingRequestCreate, BatteryPredictionRequest, 
    ChargingRequestResponse, APIResponse
)
from app.services.charging_service import ChargingService
from app.services.battery_service import BatteryService

router = APIRouter(prefix="/api/charging", tags=["充电排队"])

@router.post("/request", response_model=APIResponse)
def create_charging_request(data: ChargingRequestCreate, db: Session = Depends(get_db)):
    service = ChargingService(db)
    result = service.create_charging_request(data)
    
    if not result.get("success"):
        return APIResponse(
            success=False,
            code=result.get("code", "ERROR"),
            message=result.get("message", "操作失败"),
            errors=result.get("errors")
        )
    
    return APIResponse(
        success=True,
        code=result["code"],
        message=result["message"],
        data=result.get("data")
    )

@router.post("/predict", response_model=APIResponse)
def predict_battery(data: BatteryPredictionRequest, db: Session = Depends(get_db)):
    service = BatteryService(db)
    
    try:
        prediction = service.predict_charging_time(
            forklift_code=data.forklift_code,
            current_percent=data.current_percent,
            target_percent=data.target_percent,
            station_code=data.station_code
        )
        return APIResponse(
            success=True,
            code="OK",
            message="电量预测完成",
            data=prediction.dict()
        )
    except ValueError as e:
        return APIResponse(
            success=False,
            code="PREDICTION_FAILED",
            message=str(e)
        )

@router.get("/queue", response_model=APIResponse)
def get_queue_status(db: Session = Depends(get_db)):
    service = ChargingService(db)
    status = service.get_queue_status()
    
    return APIResponse(
        success=True,
        code="OK",
        message="队列状态查询成功",
        data=status
    )

@router.post("/complete/{request_id}", response_model=APIResponse)
def complete_charging(request_id: int, db: Session = Depends(get_db)):
    service = ChargingService(db)
    result = service.complete_charging(request_id)
    
    if not result.get("success"):
        return APIResponse(
            success=False,
            code=result.get("code", "ERROR"),
            message=result.get("message", "操作失败")
        )
    
    return APIResponse(
        success=True,
        code=result["code"],
        message=result["message"],
        data=result.get("data")
    )

@router.get("/requests/{request_id}", response_model=APIResponse)
def get_request(request_id: int, db: Session = Depends(get_db)):
    request = db.query(ChargingRequest).filter(
        ChargingRequest.id == request_id
    ).first()
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="充电请求不存在"
        )
    
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data={"request": ChargingRequestResponse.from_orm(request).dict()}
    )

@router.get("/requests", response_model=APIResponse)
def list_requests(
    status_filter: Optional[ChargingStatus] = None,
    forklift_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ChargingRequest)
    
    if status_filter:
        query = query.filter(ChargingRequest.status == status_filter)
    if forklift_id:
        query = query.filter(ChargingRequest.forklift_id == forklift_id)
    
    requests = query.order_by(ChargingRequest.created_at.desc()).all()
    
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data={
            "requests": [ChargingRequestResponse.from_orm(r).dict() for r in requests],
            "total": len(requests)
        }
    )
