from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import json
from . import models, schemas, crud
from .database import engine, get_db, init_db
from .schemas import can_transition, STATUS_TRANSITIONS

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="家电维修店接单排期工作台",
    description="小型家电维修店的接单排期管理系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def create_initial_data(db: Session):
    if db.query(models.Technician).count() == 0:
        technicians = [
            models.Technician(name="张师傅", phone="13800138001", is_active=True),
            models.Technician(name="李师傅", phone="13800138002", is_active=True),
            models.Technician(name="王师傅", phone="13800138003", is_active=True),
        ]
        for tech in technicians:
            db.add(tech)
    
    if db.query(models.SparePart).count() == 0:
        spare_parts = [
            models.SparePart(name="电饭煲加热盘", sku="RICE-001", category="电饭煲", stock_quantity=15, min_stock=5, unit_price=85.0, unit="个"),
            models.SparePart(name="电饭煲温控器", sku="RICE-002", category="电饭煲", stock_quantity=20, min_stock=5, unit_price=45.0, unit="个"),
            models.SparePart(name="空气炸锅加热管", sku="AIR-001", category="空气炸锅", stock_quantity=10, min_stock=3, unit_price=120.0, unit="个"),
            models.SparePart(name="空气炸锅风机", sku="AIR-002", category="空气炸锅", stock_quantity=8, min_stock=3, unit_price=95.0, unit="个"),
            models.SparePart(name="咖啡机水泵", sku="COFFEE-001", category="咖啡机", stock_quantity=5, min_stock=2, unit_price=180.0, unit="个"),
            models.SparePart(name="咖啡机加热棒", sku="COFFEE-002", category="咖啡机", stock_quantity=3, min_stock=2, unit_price=150.0, unit="个"),
            models.SparePart(name="通用密封胶圈", sku="GEN-001", category="通用", stock_quantity=50, min_stock=10, unit_price=15.0, unit="个"),
            models.SparePart(name="通用电源线", sku="GEN-002", category="通用", stock_quantity=30, min_stock=10, unit_price=25.0, unit="条"),
        ]
        for part in spare_parts:
            db.add(part)
    
    db.commit()

@app.on_event("startup")
def startup_event():
    init_db()
    db = next(get_db())
    try:
        create_initial_data(db)
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "家电维修店接单排期工作台 API", "version": "1.0.0"}

@app.get("/api/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    return crud.get_dashboard_stats(db)

@app.get("/api/dashboard/low-stock", response_model=List[schemas.SparePart])
def get_low_stock_parts(db: Session = Depends(get_db)):
    return crud.get_spare_parts(db, low_stock_only=True)

@app.get("/api/dashboard/overdue-orders", response_model=List[schemas.RepairOrder])
def get_overdue_orders(db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    start_of_today = datetime(today.year, today.month, today.day, 0, 0, 0)
    from sqlalchemy import and_
    return db.query(models.RepairOrder).filter(
        models.RepairOrder.appointment_time < start_of_today,
        models.RepairOrder.status.notin_(["已完成", "已取消"])
    ).order_by(models.RepairOrder.appointment_time).all()

@app.get("/api/technicians", response_model=List[schemas.Technician])
def list_technicians(
    active_only: bool = Query(False, description="仅显示活跃技师"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_technicians(db, skip=skip, limit=limit, active_only=active_only)

@app.post("/api/technicians", response_model=schemas.Technician)
def create_technician(technician: schemas.TechnicianCreate, db: Session = Depends(get_db)):
    return crud.create_technician(db, technician)

@app.get("/api/technicians/{technician_id}", response_model=schemas.Technician)
def get_technician(technician_id: int, db: Session = Depends(get_db)):
    tech = crud.get_technician(db, technician_id)
    if not tech:
        raise HTTPException(status_code=404, detail="技师不存在")
    return tech

@app.put("/api/technicians/{technician_id}", response_model=schemas.Technician)
def update_technician(technician_id: int, technician: schemas.TechnicianUpdate, db: Session = Depends(get_db)):
    tech = crud.update_technician(db, technician_id, technician)
    if not tech:
        raise HTTPException(status_code=404, detail="技师不存在")
    return tech

@app.get("/api/technicians/{technician_id}/schedule", response_model=List[schemas.RepairOrder])
def get_technician_schedule(
    technician_id: int,
    date: Optional[str] = Query(None, description="日期格式: YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    tech = crud.get_technician(db, technician_id)
    if not tech:
        raise HTTPException(status_code=404, detail="技师不存在")
    
    if date:
        try:
            schedule_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误，请使用 YYYY-MM-DD")
    else:
        schedule_date = datetime.utcnow()
    
    return crud.get_technician_schedule(db, technician_id, schedule_date)

@app.get("/api/spare-parts", response_model=List[schemas.SparePart])
def list_spare_parts(
    low_stock_only: bool = Query(False),
    category: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_spare_parts(db, skip=skip, limit=limit, low_stock_only=low_stock_only, category=category)

@app.post("/api/spare-parts", response_model=schemas.SparePart)
def create_spare_part(spare_part: schemas.SparePartCreate, db: Session = Depends(get_db)):
    if spare_part.sku:
        existing = crud.get_spare_part_by_sku(db, spare_part.sku)
        if existing:
            raise HTTPException(status_code=400, detail=f"SKU {spare_part.sku} 已存在")
    return crud.create_spare_part(db, spare_part)

@app.get("/api/spare-parts/{spare_part_id}", response_model=schemas.SparePart)
def get_spare_part(spare_part_id: int, db: Session = Depends(get_db)):
    part = crud.get_spare_part(db, spare_part_id)
    if not part:
        raise HTTPException(status_code=404, detail="备件不存在")
    return part

@app.put("/api/spare-parts/{spare_part_id}", response_model=schemas.SparePart)
def update_spare_part(spare_part_id: int, spare_part: schemas.SparePartUpdate, db: Session = Depends(get_db)):
    part = crud.update_spare_part(db, spare_part_id, spare_part)
    if not part:
        raise HTTPException(status_code=404, detail="备件不存在")
    return part

@app.post("/api/spare-parts/{spare_part_id}/stock-in", response_model=schemas.SparePart)
def stock_in_spare_part(
    spare_part_id: int,
    adjust: schemas.SparePartStockAdjust,
    db: Session = Depends(get_db)
):
    part = crud.adjust_spare_part_stock(db, spare_part_id, adjust.quantity, adjust.notes)
    if not part:
        raise HTTPException(status_code=404, detail="备件不存在")
    return part

@app.get("/api/repair-orders", response_model=List[schemas.RepairOrder])
def list_repair_orders(
    status: Optional[str] = Query(None),
    technician_id: Optional[int] = Query(None),
    customer_name: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="开始日期格式错误")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="结束日期格式错误")
    
    return crud.get_repair_orders(
        db,
        skip=skip,
        limit=limit,
        status=status,
        technician_id=technician_id,
        customer_name=customer_name,
        start_date=start_dt,
        end_date=end_dt
    )

@app.post("/api/repair-orders", response_model=schemas.RepairOrder)
def create_repair_order(order: schemas.RepairOrderCreate, db: Session = Depends(get_db)):
    db_order, error = crud.create_repair_order(db, order)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_order

@app.get("/api/repair-orders/{order_id}", response_model=schemas.RepairOrder)
def get_repair_order(order_id: int, db: Session = Depends(get_db)):
    order = crud.get_repair_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="维修单不存在")
    return order

@app.put("/api/repair-orders/{order_id}", response_model=schemas.RepairOrder)
def update_repair_order(order_id: int, order: schemas.RepairOrderUpdate, db: Session = Depends(get_db)):
    db_order, error = crud.update_repair_order(db, order_id, order)
    if error:
        raise HTTPException(status_code=400, detail=error)
    if not db_order:
        raise HTTPException(status_code=404, detail="维修单不存在")
    return db_order

@app.patch("/api/repair-orders/{order_id}/status", response_model=schemas.RepairOrder)
def update_order_status(order_id: int, status_update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    db_order, error = crud.update_order_status(db, order_id, status_update.status, status_update.reason)
    if error:
        raise HTTPException(status_code=400, detail=error)
    if not db_order:
        raise HTTPException(status_code=404, detail="维修单不存在")
    return db_order

@app.get("/api/repair-orders/{order_id}/valid-transitions")
def get_valid_transitions(order_id: int, db: Session = Depends(get_db)):
    order = crud.get_repair_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="维修单不存在")
    
    valid_transitions = STATUS_TRANSITIONS.get(order.status, [])
    return {
        "current_status": order.status,
        "valid_transitions": valid_transitions
    }

@app.patch("/api/repair-orders/{order_id}/cost", response_model=schemas.RepairOrder)
def adjust_order_cost(order_id: int, cost_adjust: schemas.CostAdjustment, db: Session = Depends(get_db)):
    db_order, error = crud.adjust_order_cost(db, order_id, cost_adjust)
    if error:
        raise HTTPException(status_code=400, detail=error)
    if not db_order:
        raise HTTPException(status_code=404, detail="维修单不存在")
    return db_order

@app.post("/api/repair-orders/{order_id}/mark-paid", response_model=schemas.RepairOrder)
def mark_order_paid(order_id: int, db: Session = Depends(get_db)):
    db_order, error = crud.mark_order_paid(db, order_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    if not db_order:
        raise HTTPException(status_code=404, detail="维修单不存在")
    return db_order

@app.post("/api/repair-orders/{order_id}/consume-parts")
def consume_spare_parts(
    order_id: int,
    items: List[schemas.SparePartConsume],
    db: Session = Depends(get_db)
):
    if not items:
        raise HTTPException(status_code=400, detail="请选择要消耗的备件")
    
    success, errors = crud.consume_spare_parts(db, order_id, items)
    if not success:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    
    return {"success": True, "message": "备件消耗成功"}

@app.post("/api/repair-orders/{order_id}/communication-logs", response_model=schemas.CommunicationLog)
def add_communication_log(
    order_id: int,
    log: schemas.CommunicationLogCreate,
    db: Session = Depends(get_db)
):
    db_log = crud.add_communication_log(db, order_id, log)
    if not db_log:
        raise HTTPException(status_code=404, detail="维修单不存在")
    return db_log

@app.get("/api/status-transitions")
def get_all_status_transitions():
    return STATUS_TRANSITIONS

@app.get("/api/device-types")
def get_device_types():
    return [e.value for e in schemas.DeviceType]

@app.get("/api/order-statuses")
def get_order_statuses():
    return [e.value for e in schemas.OrderStatus]

def validate_backup_data(data: dict) -> List[str]:
    errors = []
    
    valid_statuses = [e.value for e in schemas.OrderStatus]
    valid_transitions = schemas.STATUS_TRANSITIONS
    
    for i, order in enumerate(data.get("repair_orders", [])):
        status = order.get("status")
        if status and status not in valid_statuses:
            errors.append(f"维修单 {order.get('order_no', i)}: 无效状态 '{status}'")
        
        appointment_time = order.get("appointment_time")
        technician_id = order.get("technician_id")
        if appointment_time and technician_id:
            pass
    
    for i, part in enumerate(data.get("spare_parts", [])):
        stock = part.get("stock_quantity", 0)
        if stock < 0:
            errors.append(f"备件 {part.get('sku', i)}: 库存不能为负数")
        
        min_stock = part.get("min_stock", 0)
        if min_stock < 0:
            errors.append(f"备件 {part.get('sku', i)}: 最低库存不能为负数")
    
    for i, tech in enumerate(data.get("technicians", [])):
        if not tech.get("name"):
            errors.append(f"技师 {i}: 姓名不能为空")
    
    return errors

@app.get("/api/backup/export")
def export_data(db: Session = Depends(get_db)):
    technicians = db.query(models.Technician).all()
    spare_parts = db.query(models.SparePart).all()
    repair_orders = db.query(models.RepairOrder).all()
    communication_logs = db.query(models.CommunicationLog).all()
    status_histories = db.query(models.StatusHistory).all()
    inventory_transactions = db.query(models.InventoryTransaction).all()
    
    def to_dict(obj):
        if obj is None:
            return None
        d = {}
        for column in obj.__table__.columns:
            value = getattr(obj, column.name)
            if isinstance(value, datetime):
                d[column.name] = value.isoformat()
            else:
                d[column.name] = value
        return d
    
    data = {
        "version": "1.0",
        "exported_at": datetime.utcnow().isoformat(),
        "technicians": [to_dict(t) for t in technicians],
        "spare_parts": [to_dict(p) for p in spare_parts],
        "repair_orders": [to_dict(o) for o in repair_orders],
        "communication_logs": [to_dict(l) for l in communication_logs],
        "status_histories": [to_dict(h) for h in status_histories],
        "inventory_transactions": [to_dict(t) for t in inventory_transactions],
    }
    
    return data

@app.post("/api/backup/import")
async def import_data(
    file: UploadFile = File(...),
    overwrite: bool = Query(False, description="是否覆盖现有数据"),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        data = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="无效的 JSON 格式")
    
    errors = validate_backup_data(data)
    if errors:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "数据验证失败",
                "errors": errors
            }
        )
    
    try:
        if overwrite:
            db.query(models.InventoryTransaction).delete()
            db.query(models.CommunicationLog).delete()
            db.query(models.StatusHistory).delete()
            db.query(models.RepairOrder).delete()
            db.query(models.SparePart).delete()
            db.query(models.Technician).delete()
        
        for tech_data in data.get("technicians", []):
            tech = models.Technician()
            for key, value in tech_data.items():
                if key == "created_at" or key == "updated_at":
                    if value:
                        setattr(tech, key, datetime.fromisoformat(value))
                elif hasattr(tech, key):
                    setattr(tech, key, value)
            db.add(tech)
        
        db.flush()
        
        for part_data in data.get("spare_parts", []):
            part = models.SparePart()
            for key, value in part_data.items():
                if key == "created_at" or key == "updated_at":
                    if value:
                        setattr(part, key, datetime.fromisoformat(value))
                elif hasattr(part, key):
                    setattr(part, key, value)
            db.add(part)
        
        db.flush()
        
        for order_data in data.get("repair_orders", []):
            order = models.RepairOrder()
            for key, value in order_data.items():
                if key in ["created_at", "updated_at", "appointment_time", 
                           "arrival_time", "start_repair_time", "complete_time", "paid_at"]:
                    if value:
                        setattr(order, key, datetime.fromisoformat(value))
                elif hasattr(order, key):
                    setattr(order, key, value)
            db.add(order)
        
        db.flush()
        
        for log_data in data.get("communication_logs", []):
            log = models.CommunicationLog()
            for key, value in log_data.items():
                if key == "created_at":
                    if value:
                        setattr(log, key, datetime.fromisoformat(value))
                elif hasattr(log, key):
                    setattr(log, key, value)
            db.add(log)
        
        for history_data in data.get("status_histories", []):
            history = models.StatusHistory()
            for key, value in history_data.items():
                if key == "created_at":
                    if value:
                        setattr(history, key, datetime.fromisoformat(value))
                elif hasattr(history, key):
                    setattr(history, key, value)
            db.add(history)
        
        for trans_data in data.get("inventory_transactions", []):
            trans = models.InventoryTransaction()
            for key, value in trans_data.items():
                if key == "created_at":
                    if value:
                        setattr(trans, key, datetime.fromisoformat(value))
                elif hasattr(trans, key):
                    setattr(trans, key, value)
            db.add(trans)
        
        db.commit()
        
        total_records = sum([
            len(data.get("technicians", [])),
            len(data.get("spare_parts", [])),
            len(data.get("repair_orders", [])),
            len(data.get("communication_logs", [])),
            len(data.get("status_histories", [])),
            len(data.get("inventory_transactions", [])),
        ])
        
        return {
            "success": True,
            "message": "数据导入成功",
            "imported": total_records,
            "overwrite": overwrite
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
