from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db, engine, Base
from app.models import Store, Material, SalesRecord, SafetyStock
from app.schemas import (
    StoreCreate, StoreUpdate, StoreResponse,
    MaterialCreate, MaterialUpdate, MaterialResponse,
    SalesRecordCreate, SalesRecordResponse,
    SafetyStockCreate, SafetyStockUpdate, SafetyStockResponse,
    ReplenishmentOrderCreate, ReplenishmentOrderUpdate,
    ReplenishmentOrderResponse, ReplenishmentStatusUpdate,
    AlertReportCreate, AlertReportResponse, AlertReportHandle,
    AlertMergeRequest,
    ForecastRequest, ForecastResponse,
    SuccessResponse,
)
from app.services import ForecastService, ReplenishmentService, AlertService, ExportService

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="茶饮原料销量预测补货预警API",
    description="基于FastAPI + SQLite的茶饮店库存管理系统",
    version="1.0.0"
)


@app.get("/")
def root():
    return {"message": "茶饮原料销量预测补货预警API", "version": "1.0.0"}


@app.post("/stores/", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
def create_store(store: StoreCreate, db: Session = Depends(get_db)):
    db_store = Store(**store.model_dump())
    db.add(db_store)
    db.commit()
    db.refresh(db_store)
    return db_store


@app.get("/stores/", response_model=List[StoreResponse])
def list_stores(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Store).offset(skip).limit(limit).all()


@app.get("/stores/{store_id}", response_model=StoreResponse)
def get_store(store_id: int, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")
    return store


@app.put("/stores/{store_id}", response_model=StoreResponse)
def update_store(store_id: int, store_update: StoreUpdate, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")
    
    update_data = store_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(store, field, value)
    store.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(store)
    return store


@app.post("/materials/", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
def create_material(material: MaterialCreate, db: Session = Depends(get_db)):
    db_material = Material(**material.model_dump())
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


@app.get("/materials/", response_model=List[MaterialResponse])
def list_materials(category: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Material)
    if category:
        query = query.filter(Material.category == category)
    return query.offset(skip).limit(limit).all()


@app.get("/materials/{material_id}", response_model=MaterialResponse)
def get_material(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="原料不存在")
    return material


@app.put("/materials/{material_id}", response_model=MaterialResponse)
def update_material(material_id: int, material_update: MaterialUpdate, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="原料不存在")
    
    update_data = material_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(material, field, value)
    material.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(material)
    return material


@app.post("/sales/", response_model=SalesRecordResponse, status_code=status.HTTP_201_CREATED)
def create_sales_record(sales: SalesRecordCreate, db: Session = Depends(get_db)):
    db_sales = SalesRecord(**sales.model_dump())
    db.add(db_sales)
    db.commit()
    db.refresh(db_sales)
    return db_sales


@app.get("/sales/", response_model=List[SalesRecordResponse])
def list_sales(store_id: Optional[int] = None, material_id: Optional[int] = None,
               skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(SalesRecord)
    if store_id:
        query = query.filter(SalesRecord.store_id == store_id)
    if material_id:
        query = query.filter(SalesRecord.material_id == material_id)
    return query.order_by(SalesRecord.sales_date.desc()).offset(skip).limit(limit).all()


@app.post("/safety-stock/", response_model=SafetyStockResponse, status_code=status.HTTP_201_CREATED)
def create_safety_stock(safety_stock: SafetyStockCreate, db: Session = Depends(get_db)):
    existing = db.query(SafetyStock).filter(
        SafetyStock.store_id == safety_stock.store_id,
        SafetyStock.material_id == safety_stock.material_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该门店原料的安全库存已存在")
    
    db_safety_stock = SafetyStock(**safety_stock.model_dump())
    db.add(db_safety_stock)
    db.commit()
    db.refresh(db_safety_stock)
    return db_safety_stock


@app.get("/safety-stock/", response_model=List[SafetyStockResponse])
def list_safety_stock(store_id: Optional[int] = None, material_id: Optional[int] = None,
                     skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(SafetyStock)
    if store_id:
        query = query.filter(SafetyStock.store_id == store_id)
    if material_id:
        query = query.filter(SafetyStock.material_id == material_id)
    return query.offset(skip).limit(limit).all()


@app.put("/safety-stock/{ss_id}", response_model=SafetyStockResponse)
def update_safety_stock(ss_id: int, ss_update: SafetyStockUpdate, db: Session = Depends(get_db)):
    safety_stock = db.query(SafetyStock).filter(SafetyStock.id == ss_id).first()
    if not safety_stock:
        raise HTTPException(status_code=404, detail="安全库存配置不存在")
    
    update_data = ss_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(safety_stock, field, value)
    safety_stock.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(safety_stock)
    return safety_stock


@app.post("/replenishment/", response_model=ReplenishmentOrderResponse, status_code=status.HTTP_201_CREATED)
def create_replenishment_order(order: ReplenishmentOrderCreate, db: Session = Depends(get_db)):
    service = ReplenishmentService(db)
    return service.create_order(order)


@app.get("/replenishment/", response_model=List[ReplenishmentOrderResponse])
def list_replenishment_orders(store_id: Optional[int] = None, status: Optional[str] = None,
                                skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    from app.models import ReplenishmentOrder
    query = db.query(ReplenishmentOrder)
    if store_id:
        query = query.filter(ReplenishmentOrder.store_id == store_id)
    if status:
        query = query.filter(ReplenishmentOrder.status == status)
    return query.order_by(ReplenishmentOrder.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/replenishment/{order_id}", response_model=ReplenishmentOrderResponse)
def get_replenishment_order(order_id: int, db: Session = Depends(get_db)):
    service = ReplenishmentService(db)
    order = service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="补货订单不存在")
    return order


@app.put("/replenishment/{order_id}", response_model=ReplenishmentOrderResponse)
def update_replenishment_order(order_id: int, order_update: ReplenishmentOrderUpdate,
                              db: Session = Depends(get_db)):
    service = ReplenishmentService(db)
    try:
        order = service.update_order(order_id, order_update)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not order:
        raise HTTPException(status_code=404, detail="补货订单不存在")
    return order


@app.patch("/replenishment/{order_id}/status", response_model=ReplenishmentOrderResponse)
def update_replenishment_status(order_id: int, status_update: ReplenishmentStatusUpdate,
                                  db: Session = Depends(get_db)):
    service = ReplenishmentService(db)
    try:
        order = service.update_status(order_id, status_update)
    except ValueError as e:
        error_msg = str(e)
        if "需要人工复核" in error_msg:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "MANUAL_REVIEW_REQUIRED",
                    "message": "需要人工复核",
                    "review_reason": error_msg
                }
            )
        elif "状态" in error_msg and "无法转换" in error_msg:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "STATUS_NOT_ALLOWED",
                    "message": error_msg,
                    "current_status": "",
                    "allowed_statuses": []
                }
            )
        raise HTTPException(status_code=400, detail=error_msg)
    if not order:
        raise HTTPException(status_code=404, detail="补货订单不存在")
    return order


@app.patch("/replenishment/{order_id}/mark-review", response_model=ReplenishmentOrderResponse)
def mark_order_for_review(order_id: int, review_reason: str, db: Session = Depends(get_db)):
    service = ReplenishmentService(db)
    order = service.mark_for_review(order_id, review_reason)
    if not order:
        raise HTTPException(status_code=404, detail="补货订单不存在")
    return order


@app.patch("/replenishment/{order_id}/approve-review", response_model=ReplenishmentOrderResponse)
def approve_order_after_review(order_id: int, approved_by: str, db: Session = Depends(get_db)):
    service = ReplenishmentService(db)
    try:
        order = service.approve_after_review(order_id, approved_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not order:
        raise HTTPException(status_code=404, detail="补货订单不存在")
    return order


@app.post("/alerts/", response_model=AlertReportResponse, status_code=status.HTTP_201_CREATED)
def create_alert(alert: AlertReportCreate, db: Session = Depends(get_db)):
    service = AlertService(db)
    return service.create_alert(alert)


@app.get("/alerts/", response_model=List[AlertReportResponse])
def list_alerts(store_id: Optional[int] = None, status: Optional[str] = None,
                skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = AlertService(db)
    if status:
        return service.get_alerts_by_status(status, store_id)[skip:skip+limit]
    from app.models import AlertReport
    query = db.query(AlertReport)
    if store_id:
        query = query.filter(AlertReport.store_id == store_id)
    return query.order_by(AlertReport.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/alerts/{alert_id}", response_model=AlertReportResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    service = AlertService(db)
    alert = service.get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="预警不存在")
    return alert


@app.patch("/alerts/{alert_id}/handle", response_model=AlertReportResponse)
def handle_alert(alert_id: int, handle_data: AlertReportHandle, db: Session = Depends(get_db)):
    service = AlertService(db)
    try:
        alert = service.handle_alert(alert_id, handle_data)
    except ValueError as e:
        error_msg = str(e)
        if "已处理" in error_msg:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": "ALREADY_PROCESSED",
                    "message": error_msg
                }
            )
        raise HTTPException(status_code=400, detail=error_msg)
    if not alert:
        raise HTTPException(status_code=404, detail="预警不存在")
    return alert


@app.post("/alerts/merge", response_model=AlertReportResponse)
def merge_alerts(merge_request: AlertMergeRequest, db: Session = Depends(get_db)):
    service = AlertService(db)
    try:
        return service.merge_alerts(merge_request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/forecast/", response_model=ForecastResponse)
def generate_forecast(request: ForecastRequest, db: Session = Depends(get_db)):
    service = ForecastService(db)
    try:
        return service.generate_forecast(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/export/alerts")
def export_alerts(store_id: Optional[int] = None, status: Optional[str] = None,
                  days: int = 30, db: Session = Depends(get_db)):
    service = ExportService(db)
    output = service.export_alerts_to_excel(store_id, status, days)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=alerts_report_{datetime.now().strftime('%Y%m%d')}.xlsx"}
    )


@app.get("/export/replenishment")
def export_replenishment(store_id: Optional[int] = None, status: Optional[str] = None,
                         days: int = 30, db: Session = Depends(get_db)):
    service = ExportService(db)
    output = service.export_replenishment_to_excel(store_id, status, days)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=replenishment_report_{datetime.now().strftime('%Y%m%d')}.xlsx"}
    )


@app.get("/export/sales")
def export_sales(store_id: Optional[int] = None, material_id: Optional[int] = None,
                 days: int = 30, db: Session = Depends(get_db)):
    service = ExportService(db)
    output = service.export_sales_to_excel(store_id, material_id, days)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=sales_report_{datetime.now().strftime('%Y%m%d')}.xlsx"}
    )


@app.post("/export/forecast")
def export_forecast(request: ForecastRequest, db: Session = Depends(get_db)):
    forecast_service = ForecastService(db)
    export_service = ExportService(db)
    try:
        forecast_result = forecast_service.generate_forecast(request)
        output = export_service.export_forecast_report_to_excel(forecast_result.model_dump())
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=forecast_report_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
