from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import csv
import json
import io
from typing import List

from database import get_db, engine
import models
import schemas
from services import MaterialImportService

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="供水抢修领料管理API",
    description="解决夜间抢修领料导入混乱问题，支持CSV/JSON导入，自动校验分类",
    version="1.0.0"
)


@app.on_event("startup")
def startup_event():
    db = next(get_db())
    if db.query(models.Inventory).count() == 0:
        init_sample_data(db)


def init_sample_data(db: Session):
    inventory_items = [
        {"material_code": "VAL-001", "material_name": "DN100闸阀", "quantity": 50, "unit": "个", "warehouse": "主仓库"},
        {"material_code": "VAL-002", "material_name": "DN50球阀", "quantity": 100, "unit": "个", "warehouse": "主仓库"},
        {"material_code": "PIP-001", "material_name": "PE管DN100", "quantity": 200, "unit": "米", "warehouse": "主仓库"},
        {"material_code": "TOO-001", "material_name": "管钳12寸", "quantity": 20, "unit": "把", "warehouse": "工具库"},
        {"material_code": "TOO-002", "material_name": "活动扳手", "quantity": 30, "unit": "把", "warehouse": "工具库"},
        {"material_code": "FIT-001", "material_name": "弯头DN100", "quantity": 80, "unit": "个", "warehouse": "主仓库"},
    ]
    for item in inventory_items:
        db.add(models.Inventory(**item))

    vehicle_items = [
        {"vehicle_id": "VEH-001", "vehicle_plate": "沪A12345", "driver": "张三", "team": "抢修一班", "status": "正常"},
        {"vehicle_id": "VEH-002", "vehicle_plate": "沪B67890", "driver": "李四", "team": "抢修二班", "status": "维修中"},
        {"vehicle_id": "VEH-003", "vehicle_plate": "沪C54321", "driver": "王五", "team": "抢修一班", "status": "正常"},
    ]
    for item in vehicle_items:
        db.add(models.Vehicle(**item))

    db.commit()


@app.post("/api/import/materials", response_model=schemas.ImportResult)
def import_materials(
    batch_id: str = None,
    csv_file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    if csv_file:
        content = csv_file.file.read().decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(content))
        items = []
        for row in csv_reader:
            item = {
                "repair_order_no": row.get("抢修单号", row.get("repair_order_no", "")),
                "material_code": row.get("物料编码", row.get("material_code", "")),
                "material_name": row.get("物料名称", row.get("material_name", "")),
                "quantity": float(row.get("数量", row.get("quantity", 0))),
                "unit": row.get("单位", row.get("unit", "")),
                "vehicle_id": row.get("车辆ID", row.get("vehicle_id", "")),
                "operator": row.get("操作人", row.get("operator", "")),
                "operation_type": row.get("操作类型", row.get("operation_type", "领用")),
                "is_emergency": row.get("是否紧急", row.get("is_emergency", "false")).lower() in ["true", "1", "是"]
            }
            items.append(item)
    else:
        raise HTTPException(status_code=400, detail="请上传CSV文件")

    service = MaterialImportService(db)
    result = service.process_import(items, batch_id)
    return result


@app.post("/api/import/vehicles")
def import_vehicles(
    json_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = json_file.file.read().decode('utf-8')
    vehicle_data = json.loads(content)

    if isinstance(vehicle_data, dict) and "vehicles" in vehicle_data:
        vehicle_list = vehicle_data["vehicles"]
    elif isinstance(vehicle_data, list):
        vehicle_list = vehicle_data
    else:
        raise HTTPException(status_code=400, detail="车辆数据格式错误")

    imported_count = 0
    for item in vehicle_list:
        existing = db.query(models.Vehicle).filter(models.Vehicle.vehicle_id == item["vehicle_id"]).first()
        if existing:
            existing.vehicle_plate = item["vehicle_plate"]
            existing.driver = item["driver"]
            existing.team = item["team"]
            existing.status = item["status"]
        else:
            db.add(models.Vehicle(**item))
            imported_count += 1

    db.commit()
    return {"message": f"成功导入{imported_count}辆车信息"}


@app.get("/api/inventory")
def get_inventory(db: Session = Depends(get_db)):
    inventories = db.query(models.Inventory).all()
    return inventories


@app.get("/api/vehicles")
def get_vehicles(db: Session = Depends(get_db)):
    vehicles = db.query(models.Vehicle).all()
    return vehicles


@app.get("/api/batches")
def get_batches(db: Session = Depends(get_db)):
    batches = db.query(models.ProcessedBatch).order_by(models.ProcessedBatch.process_time.desc()).all()
    return batches


@app.get("/api/batch/{batch_id}")
def get_batch_detail(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(models.ProcessedBatch).filter(models.ProcessedBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    records = db.query(models.MaterialImport).filter(models.MaterialImport.batch_id == batch_id).all()

    success_items = []
    pending_items = []
    failed_items = []

    for record in records:
        item = {
            "repair_order_no": record.repair_order_no,
            "material_code": record.material_code,
            "material_name": record.material_name,
            "quantity": record.quantity,
            "unit": record.unit,
            "vehicle_id": record.vehicle_id,
            "operator": record.operator,
            "operation_type": record.operation_type
        }
        processed_item = {
            "item": item,
            "status": record.status,
            "suggestion": record.suggestion,
            "raw_data": json.loads(record.raw_data) if record.raw_data else None
        }

        if record.status == "success":
            success_items.append(processed_item)
        elif record.status == "pending":
            pending_items.append(processed_item)
        else:
            failed_items.append(processed_item)

    return {
        "batch_id": batch_id,
        "process_time": batch.process_time,
        "total_count": batch.total_count,
        "success_count": batch.success_count,
        "pending_count": batch.pending_count,
        "failed_count": batch.failed_count,
        "success_items": success_items,
        "pending_items": pending_items,
        "failed_items": failed_items
    }


@app.get("/api/record/{record_id}")
def get_record_detail(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.MaterialImport).filter(models.MaterialImport.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    return {
        "id": record.id,
        "batch_id": record.batch_id,
        "repair_order_no": record.repair_order_no,
        "material_code": record.material_code,
        "material_name": record.material_name,
        "quantity": record.quantity,
        "unit": record.unit,
        "vehicle_id": record.vehicle_id,
        "operator": record.operator,
        "operation_type": record.operation_type,
        "import_time": record.import_time,
        "status": record.status,
        "suggestion": record.suggestion,
        "raw_data": json.loads(record.raw_data) if record.raw_data else None
    }


@app.get("/")
def root():
    return {
        "name": "供水抢修领料管理API",
        "version": "1.0.0",
        "docs": "/docs",
        "description": "解决夜间抢修领料导入混乱问题"
    }
