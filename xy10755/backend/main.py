from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from database import engine, get_db, Base
from models import Order, OrderLine, Warehouse, Inventory, FulfillmentRecord, WarehouseChangeLog, ShippingRule
from schemas import (
    OrderCreate, OrderResponse, OrderLineResponse,
    FulfillmentRecordResponse, WarehouseChangeLogResponse,
    WarehouseResponse, InventoryResponse,
    SplitOrderRequest, WarehouseChangeRequest,
    ShippingRuleCorrectionRequest, OrderDetailResponse
)
from services import SplitOrderService

Base.metadata.create_all(bind=engine)

app = FastAPI(title="多仓履约拆单API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/orders/", response_model=OrderResponse)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    db_order = db.query(Order).filter(Order.order_no == order.order_no).first()
    if db_order:
        raise HTTPException(status_code=400, detail="订单号已存在")

    db_order = Order(
        order_no=order.order_no,
        customer_name=order.customer_name,
        customer_address=order.customer_address,
        raw_input=order.raw_input
    )
    db.add(db_order)
    db.flush()

    for line in order.order_lines:
        db_line = OrderLine(
            order_id=db_order.id,
            sku=line.sku,
            product_name=line.product_name,
            quantity=line.quantity,
            unit_price=line.unit_price,
            original_input=line.original_input
        )
        db.add(db_line)

    db.commit()
    db.refresh(db_order)
    return db_order


@app.get("/api/orders/", response_model=List[OrderResponse])
def list_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    order_no: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    if order_no:
        query = query.filter(Order.order_no.contains(order_no))
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders


@app.get("/api/orders/{order_id}", response_model=OrderDetailResponse)
def get_order_detail(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    order_lines = db.query(OrderLine).filter(OrderLine.order_id == order_id).all()
    fulfillment_records = db.query(FulfillmentRecord).filter(FulfillmentRecord.order_id == order_id).all()
    warehouse_change_logs = db.query(WarehouseChangeLog).filter(WarehouseChangeLog.order_id == order_id).all()

    return {
        "order": order,
        "order_lines": order_lines,
        "fulfillment_records": fulfillment_records,
        "warehouse_change_logs": warehouse_change_logs
    }


@app.post("/api/orders/split/")
def split_order(request: SplitOrderRequest, db: Session = Depends(get_db)):
    service = SplitOrderService(db)
    result = service.split_order(request.order_no, request.idempotency_key)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/api/fulfillment/change-warehouse/")
def change_warehouse(request: WarehouseChangeRequest, db: Session = Depends(get_db)):
    service = SplitOrderService(db)
    result = service.change_warehouse(
        request.fulfillment_record_id,
        request.new_warehouse_code,
        request.reason,
        request.processed_by
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/api/fulfillment/correct-shipping/")
def correct_shipping(request: ShippingRuleCorrectionRequest, db: Session = Depends(get_db)):
    service = SplitOrderService(db)
    result = service.correct_shipping_rule(
        request.fulfillment_record_id,
        request.new_shipping_fee,
        request.reason,
        request.processed_by
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/api/fulfillment/{record_id}/finalize/")
def finalize_fulfillment(record_id: int, db: Session = Depends(get_db)):
    service = SplitOrderService(db)
    result = service.finalize_fulfillment(record_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/warehouses/", response_model=List[WarehouseResponse])
def list_warehouses(db: Session = Depends(get_db)):
    return db.query(Warehouse).filter(Warehouse.is_active == True).all()


@app.get("/api/inventories/", response_model=List[InventoryResponse])
def list_inventories(sku: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Inventory)
    if sku:
        query = query.filter(Inventory.sku == sku)
    return query.all()


@app.get("/api/fulfillment-records/", response_model=List[FulfillmentRecordResponse])
def list_fulfillment_records(
    order_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FulfillmentRecord)
    if order_id:
        query = query.filter(FulfillmentRecord.order_id == order_id)
    if status:
        query = query.filter(FulfillmentRecord.status == status)
    return query.order_by(FulfillmentRecord.created_at.desc()).all()


@app.get("/api/warehouse-change-logs/", response_model=List[WarehouseChangeLogResponse])
def list_change_logs(
    order_id: Optional[int] = None,
    fulfillment_record_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(WarehouseChangeLog)
    if order_id:
        query = query.filter(WarehouseChangeLog.order_id == order_id)
    if fulfillment_record_id:
        query = query.filter(WarehouseChangeLog.fulfillment_record_id == fulfillment_record_id)
    return query.order_by(WarehouseChangeLog.created_at.desc()).all()


@app.post("/api/init-sample-data/")
def init_sample_data(db: Session = Depends(get_db)):
    existing_warehouse = db.query(Warehouse).first()
    if existing_warehouse:
        return {"message": "示例数据已存在"}

    warehouses = [
        Warehouse(warehouse_code="WH001", warehouse_name="北京仓库", address="北京市朝阳区", city="北京"),
        Warehouse(warehouse_code="WH002", warehouse_name="上海仓库", address="上海市浦东新区", city="上海"),
        Warehouse(warehouse_code="WH003", warehouse_name="广州仓库", address="广州市天河区", city="广州"),
    ]
    for wh in warehouses:
        db.add(wh)
    db.flush()

    wh_map = {wh.warehouse_code: wh.id for wh in warehouses}

    inventories = [
        Inventory(warehouse_id=wh_map["WH001"], sku="SKU001", quantity=100),
        Inventory(warehouse_id=wh_map["WH001"], sku="SKU002", quantity=50),
        Inventory(warehouse_id=wh_map["WH002"], sku="SKU001", quantity=200),
        Inventory(warehouse_id=wh_map["WH002"], sku="SKU003", quantity=80),
        Inventory(warehouse_id=wh_map["WH003"], sku="SKU002", quantity=150),
        Inventory(warehouse_id=wh_map["WH003"], sku="SKU003", quantity=60),
    ]
    for inv in inventories:
        db.add(inv)

    shipping_rules = [
        ShippingRule(rule_name="北京-首重", warehouse_code="WH001", min_weight=0, max_weight=1, shipping_fee=8, priority=10),
        ShippingRule(rule_name="北京-续重", warehouse_code="WH001", min_weight=1, max_weight=5, shipping_fee=12, priority=5),
        ShippingRule(rule_name="上海-首重", warehouse_code="WH002", min_weight=0, max_weight=1, shipping_fee=10, priority=10),
        ShippingRule(rule_name="广州-首重", warehouse_code="WH003", min_weight=0, max_weight=1, shipping_fee=9, priority=10),
    ]
    for rule in shipping_rules:
        db.add(rule)

    db.commit()
    return {"message": "示例数据初始化成功"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
