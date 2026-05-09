from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import engine, Base, get_db
from app.models import VehicleQueue, TemperatureRecord, InspectionRecord
from app.schemas import (
    VehicleQueueCreate, VehicleQueueUpdateStatus,
    VehicleQueueResponse, VehicleDetailResponse,
    TemperatureRecordCreate, TemperatureRecordManualUpdate,
    TemperatureRecordResponse,
    InspectionCreate, InspectionComplete,
    InspectionRecordResponse,
    ErrorResponse
)
from app.services import QueueService, TemperatureService, InspectionService
from app.exceptions import BusinessException
from app.constants import QueueStatus

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="口岸冷藏车排队温控API",
    description="口岸冷藏车排队通关时的温控记录、查验队列和货物风险联动系统",
    version="1.0.0"
)


@app.exception_handler(BusinessException)
async def business_exception_handler(request: Request, exc: BusinessException):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "code": exc.code,
            "message": exc.message,
            "details": exc.details
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": f"HTTP_{exc.status_code}",
            "message": exc.detail,
            "details": {}
        }
    )


@app.post("/api/queue/vehicles", response_model=VehicleQueueResponse, status_code=201)
def enqueue_vehicle(data: VehicleQueueCreate, db: Session = Depends(get_db)):
    """车辆入队 - 业务入口"""
    service = QueueService(db)
    return service.enqueue_vehicle(data)


@app.get("/api/queue/vehicles", response_model=List[VehicleQueueResponse])
def list_queue(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """查询排队车辆列表 - 按优先级排序"""
    service = QueueService(db)
    return service.get_queue_list(status=status, priority=priority, limit=limit)


@app.get("/api/queue/vehicles/{vehicle_id}", response_model=VehicleDetailResponse)
def get_vehicle_detail(vehicle_id: int, db: Session = Depends(get_db)):
    """查询车辆详情 - 包含温度记录和查验记录"""
    service = QueueService(db)
    temp_service = TemperatureService(db)
    inspection_service = InspectionService(db)
    vehicle = service.get_vehicle(vehicle_id)
    temps = temp_service.get_vehicle_temperatures(vehicle_id)
    inspections = inspection_service.get_vehicle_inspections(vehicle_id)
    return {
        **{c.name: getattr(vehicle, c.name) for c in vehicle.__table__.columns},
        "temperature_records": temps,
        "inspection_records": inspections
    }


@app.patch("/api/queue/vehicles/{vehicle_id}/status", response_model=VehicleQueueResponse)
def update_vehicle_status(
    vehicle_id: int,
    data: VehicleQueueUpdateStatus,
    db: Session = Depends(get_db)
):
    """更新车辆状态 - 状态流转"""
    service = QueueService(db)
    return service.update_vehicle_status(vehicle_id, data.status, data.remark)


@app.post("/api/temperature", response_model=TemperatureRecordResponse, status_code=201)
def add_temperature(data: TemperatureRecordCreate, db: Session = Depends(get_db)):
    """上报温度片段 - 关键校验点"""
    service = TemperatureService(db)
    return service.add_temperature(data)


@app.get("/api/queue/vehicles/{vehicle_id}/temperature", response_model=List[TemperatureRecordResponse])
def get_vehicle_temperatures(vehicle_id: int, db: Session = Depends(get_db)):
    """查询车辆温度记录"""
    service = TemperatureService(db)
    return service.get_vehicle_temperatures(vehicle_id)


@app.patch("/api/temperature/{record_id}/manual-update", response_model=TemperatureRecordResponse)
def manual_update_temperature(
    record_id: int,
    data: TemperatureRecordManualUpdate,
    db: Session = Depends(get_db)
):
    """人工修改温度记录 - 异常样例场景"""
    service = TemperatureService(db)
    return service.manual_update_temperature(record_id, data)


@app.post("/api/inspection/start", response_model=InspectionRecordResponse, status_code=201)
def start_inspection(data: InspectionCreate, db: Session = Depends(get_db)):
    """开始查验 - 状态变为inspecting"""
    service = InspectionService(db)
    return service.start_inspection(data)


@app.post("/api/inspection/{inspection_id}/complete")
def complete_inspection(
    inspection_id: int,
    data: InspectionComplete,
    db: Session = Depends(get_db)
):
    """完成查验 - 判定放行/暂扣"""
    service = InspectionService(db)
    inspection, vehicle = service.complete_inspection(inspection_id, data)
    return {
        "inspection": inspection,
        "vehicle": vehicle
    }


@app.get("/api/health")
def health_check():
    """健康检查"""
    return {"status": "ok", "service": "口岸冷藏车排队温控API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
