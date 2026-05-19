from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import Optional
import uvicorn

from database import SessionLocal, init_db
from services import (
    WorkOrderService, ImportService, BillingService, 
    ReviewService, HistoryService, MasterDataService
)

app = FastAPI(title="农机合作社财务系统", description="拖拉机作业计费管理系统，支持小时/亩数/油费混合计费")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/")
async def root():
    return {"message": "农机合作社财务系统 API", "version": "1.0.0"}

@app.post("/operators/", tags=["主数据"])
async def create_operator(
    name: str,
    phone: str = "",
    id_card: str = "",
    hourly_rate: float = 0,
    db: Session = Depends(get_db)
):
    service = MasterDataService(db)
    return service.create_operator(name, phone, id_card, hourly_rate)

@app.get("/operators/", tags=["主数据"])
async def get_operators(db: Session = Depends(get_db)):
    service = MasterDataService(db)
    return service.get_all_operators()

@app.post("/tractors/", tags=["主数据"])
async def create_tractor(
    plate_number: str,
    model: str = "",
    horsepower: int = 0,
    hourly_rate: float = 0,
    area_rate: float = 0,
    db: Session = Depends(get_db)
):
    service = MasterDataService(db)
    return service.create_tractor(plate_number, model, horsepower, hourly_rate, area_rate)

@app.get("/tractors/", tags=["主数据"])
async def get_tractors(db: Session = Depends(get_db)):
    service = MasterDataService(db)
    return service.get_all_tractors()

@app.post("/work-orders/", tags=["作业单"])
async def create_work_order(
    order_no: str,
    operator_id: int,
    tractor_id: int,
    start_time: datetime,
    end_time: datetime,
    customer_name: str = "",
    work_type: str = "",
    work_area: float = 0,
    fuel_used: float = 0,
    hourly_rate: float = 0,
    area_rate: float = 0,
    fuel_price: float = 0,
    minimum_charge: float = 0,
    db: Session = Depends(get_db)
):
    service = WorkOrderService(db)
    data = {
        "order_no": order_no,
        "operator_id": operator_id,
        "tractor_id": tractor_id,
        "customer_name": customer_name,
        "work_type": work_type,
        "start_time": start_time,
        "end_time": end_time,
        "work_area": work_area,
        "fuel_used": fuel_used,
        "hourly_rate": hourly_rate,
        "area_rate": area_rate,
        "fuel_price": fuel_price,
        "minimum_charge": minimum_charge
    }
    return service.create_work_order(data)

@app.get("/work-orders/{work_order_id}", tags=["作业单"])
async def get_work_order(work_order_id: int, db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    result = service.get_work_order(work_order_id)
    if not result:
        raise HTTPException(status_code=404, detail="作业单不存在")
    return result

@app.post("/work-orders/{work_order_id}/calculate", tags=["作业单"])
async def calculate_work_order(work_order_id: int, db: Session = Depends(get_db)):
    service = WorkOrderService(db)
    return service.calculate_work_order(work_order_id)

@app.post("/import/csv", tags=["导入"])
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    csv_content = content.decode('utf-8')
    service = ImportService(db)
    return service.import_from_csv(csv_content, filename=file.filename)

@app.post("/bills/generate", tags=["账单"])
async def generate_bill(
    operator_id: int,
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db)
):
    service = BillingService(db)
    return service.generate_bill(operator_id, start_date, end_date)

@app.get("/bills/{bill_id}", tags=["账单"])
async def get_bill(bill_id: int, db: Session = Depends(get_db)):
    service = BillingService(db)
    result = service.get_bill(bill_id)
    if not result:
        raise HTTPException(status_code=404, detail="账单不存在")
    return result

@app.post("/bills/{bill_id}/review", tags=["复核"])
async def review_bill(
    bill_id: int,
    reviewer: str,
    notes: str = "",
    db: Session = Depends(get_db)
):
    service = ReviewService(db)
    return service.review_bill(bill_id, reviewer, notes)

@app.get("/history/work-orders", tags=["历史"])
async def get_work_order_history(
    operator_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = HistoryService(db)
    return service.get_work_order_history(operator_id, start_date, end_date, status)

@app.get("/history/bills", tags=["历史"])
async def get_bill_history(
    operator_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    service = HistoryService(db)
    return service.get_bill_history(operator_id, start_date, end_date)

@app.get("/history/import-batches", tags=["历史"])
async def get_import_batches(batch_id: Optional[str] = None, db: Session = Depends(get_db)):
    service = HistoryService(db)
    return service.get_import_batches(batch_id)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
