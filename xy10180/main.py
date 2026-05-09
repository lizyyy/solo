from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from database import engine, Base, get_db
from models import MaintenanceStatus, RuleType
from schemas import (
    DeviceCreate, DeviceUpdate, DeviceResponse,
    MaintenanceRuleCreate, MaintenanceRuleResponse,
    MaintenanceOrderResponse,
    CheckMaintenanceRequest, TriggerMaintenanceRequest,
    UpdateOrderStatusRequest, DelayOrderRequest,
    MaintenanceHistoryResponse,
    InventoryCreate, InventoryResponse,
    MaintenanceReport
)
import services

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="设备保养计划 API",
    description="设备保养计划管理系统，支持按小时数、次数、日期触发保养",
    version="1.0.0"
)


@app.post("/devices/", response_model=DeviceResponse, tags=["设备管理"])
def create_device(data: DeviceCreate, db: Session = Depends(get_db)):
    return services.create_device(db, data)


@app.get("/devices/", response_model=list[DeviceResponse], tags=["设备管理"])
def list_devices(db: Session = Depends(get_db)):
    return services.get_all_devices(db)


@app.get("/devices/{device_id}", response_model=DeviceResponse, tags=["设备管理"])
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = services.get_device(db, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    return device


@app.put("/devices/{device_id}", response_model=DeviceResponse, tags=["设备管理"])
def update_device(device_id: int, data: DeviceUpdate, db: Session = Depends(get_db)):
    device = services.update_device(db, device_id, data)
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    return device


@app.post("/rules/", response_model=MaintenanceRuleResponse, tags=["保养规则"])
def create_rule(data: MaintenanceRuleCreate, db: Session = Depends(get_db)):
    try:
        return services.create_maintenance_rule(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/rules/", response_model=list[MaintenanceRuleResponse], tags=["保养规则"])
def list_rules(db: Session = Depends(get_db)):
    return services.get_all_rules(db)


@app.get("/rules/device/{device_id}", response_model=list[MaintenanceRuleResponse], tags=["保养规则"])
def list_rules_by_device(device_id: int, db: Session = Depends(get_db)):
    return services.get_rules_by_device(db, device_id)


@app.post("/maintenance/check", tags=["保养检查"])
def check_maintenance(request: CheckMaintenanceRequest, db: Session = Depends(get_db)):
    try:
        return services.check_device_maintenance(db, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/maintenance/trigger", response_model=MaintenanceOrderResponse, tags=["保养工单"])
def trigger_maintenance(request: TriggerMaintenanceRequest, db: Session = Depends(get_db)):
    try:
        return services.create_maintenance_order(db, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/orders/", response_model=list[MaintenanceOrderResponse], tags=["保养工单"])
def list_orders(db: Session = Depends(get_db)):
    return services.get_all_orders(db)


@app.get("/orders/{order_id}", response_model=MaintenanceOrderResponse, tags=["保养工单"])
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = services.get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return order


@app.get("/orders/device/{device_id}", response_model=list[MaintenanceOrderResponse], tags=["保养工单"])
def list_orders_by_device(device_id: int, db: Session = Depends(get_db)):
    return services.get_orders_by_device(db, device_id)


@app.put("/orders/{order_id}/status", response_model=MaintenanceOrderResponse, tags=["保养工单"])
def update_order_status(order_id: int, request: UpdateOrderStatusRequest, db: Session = Depends(get_db)):
    try:
        return services.update_order_status(db, order_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/orders/{order_id}/delay", response_model=MaintenanceOrderResponse, tags=["保养工单"])
def delay_order(order_id: int, request: DelayOrderRequest, db: Session = Depends(get_db)):
    try:
        return services.delay_order(db, order_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/orders/{order_id}/history", response_model=list[MaintenanceHistoryResponse], tags=["保养工单"])
def get_order_history(order_id: int, db: Session = Depends(get_db)):
    return services.get_order_history(db, order_id)


@app.post("/inventory/", response_model=InventoryResponse, tags=["库存管理"])
def create_inventory(data: InventoryCreate, db: Session = Depends(get_db)):
    try:
        return services.create_inventory(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/inventory/", response_model=list[InventoryResponse], tags=["库存管理"])
def list_inventory(db: Session = Depends(get_db)):
    inventories = services.get_all_inventory(db)
    return [InventoryResponse.from_orm(inv) for inv in inventories]


@app.get("/report/summary", response_model=MaintenanceReport, tags=["统计报表"])
def get_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    device_id: Optional[int] = Query(None),
    status: Optional[MaintenanceStatus] = Query(None),
    db: Session = Depends(get_db)
):
    return services.get_maintenance_report(
        db,
        start_date=start_date,
        end_date=end_date,
        device_id=device_id,
        status=status
    )


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "ok", "service": "设备保养计划 API"}
