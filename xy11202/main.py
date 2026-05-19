from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from typing import Optional, List
import pandas as pd
import os
import tempfile

DATABASE_URL = "sqlite:///./pharmacy_inventory.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="社区药房库存管理系统", version="1.0.0")

class InventoryRecord(Base):
    __tablename__ = "inventory_records"
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(100), unique=True, index=True, nullable=False)
    product_name = Column(String(200), nullable=False)
    product_type = Column(String(50), nullable=False)
    arrival_time = Column(DateTime, nullable=False)
    temperature = Column(Float, nullable=False)
    temperature_status = Column(String(20), nullable=False)
    receiver = Column(String(100), nullable=False)
    has_damage = Column(Boolean, default=False)
    damage_description = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    reviewed_by = Column(String(100), nullable=True)
    review_time = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class InventoryCreate(BaseModel):
    batch_number: str = Field(..., description="批次号")
    product_name: str = Field(..., description="产品名称")
    product_type: str = Field(..., description="产品类型：疫苗/胰岛素")
    temperature: float = Field(..., description="温度(℃)")
    receiver: str = Field(..., description="签收人")
    has_damage: bool = Field(False, description="是否有破损")
    damage_description: Optional[str] = Field(None, description="破损描述")

class InventoryReview(BaseModel):
    batch_number: str = Field(..., description="批次号")
    reviewed_by: str = Field(..., description="复核人")
    status: str = Field(..., description="复核状态：approved/rejected")
    review_notes: Optional[str] = Field(None, description="复核备注")

class InventoryResponse(BaseModel):
    id: int
    batch_number: str
    product_name: str
    product_type: str
    arrival_time: datetime
    temperature: float
    temperature_status: str
    receiver: str
    has_damage: bool
    damage_description: Optional[str]
    status: str
    reviewed_by: Optional[str]
    review_time: Optional[datetime]
    review_notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    class Config:
        orm_mode = True

def check_temperature_status(product_type: str, temperature: float) -> str:
    if product_type == "疫苗":
        if 2 <= temperature <= 8:
            return "normal"
        else:
            return "abnormal"
    elif product_type == "胰岛素":
        if 2 <= temperature <= 8:
            return "normal"
        else:
            return "abnormal"
    return "unknown"

@app.post("/api/inventory", response_model=InventoryResponse, summary="入库登记")
def create_inventory(record: InventoryCreate):
    db = next(get_db())
    existing = db.query(InventoryRecord).filter(InventoryRecord.batch_number == record.batch_number).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"批次号 {record.batch_number} 已存在")
    if record.product_type not in ["疫苗", "胰岛素"]:
        raise HTTPException(status_code=400, detail="产品类型只能是 疫苗 或 胰岛素")
    temp_status = check_temperature_status(record.product_type, record.temperature)
    db_record = InventoryRecord(
        batch_number=record.batch_number,
        product_name=record.product_name,
        product_type=record.product_type,
        arrival_time=datetime.utcnow(),
        temperature=record.temperature,
        temperature_status=temp_status,
        receiver=record.receiver,
        has_damage=record.has_damage,
        damage_description=record.damage_description,
        status="pending"
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@app.get("/api/inventory", response_model=List[InventoryResponse], summary="查询记录")
def get_inventory(
    receiver: Optional[str] = Query(None, description="按签收人筛选"),
    reviewed_by: Optional[str] = Query(None, description="按复核人筛选"),
    status: Optional[str] = Query(None, description="按状态筛选：pending/approved/rejected"),
    temperature_status: Optional[str] = Query(None, description="按温度状态筛选：normal/abnormal"),
    product_type: Optional[str] = Query(None, description="按产品类型筛选：疫苗/胰岛素"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间")
):
    db = next(get_db())
    query = db.query(InventoryRecord)
    if receiver:
        query = query.filter(InventoryRecord.receiver == receiver)
    if reviewed_by:
        query = query.filter(InventoryRecord.reviewed_by == reviewed_by)
    if status:
        query = query.filter(InventoryRecord.status == status)
    if temperature_status:
        query = query.filter(InventoryRecord.temperature_status == temperature_status)
    if product_type:
        query = query.filter(InventoryRecord.product_type == product_type)
    if start_time:
        query = query.filter(InventoryRecord.arrival_time >= start_time)
    if end_time:
        query = query.filter(InventoryRecord.arrival_time <= end_time)
    records = query.order_by(InventoryRecord.arrival_time.desc()).all()
    return records

@app.post("/api/inventory/review", response_model=InventoryResponse, summary="复核记录")
def review_inventory(review: InventoryReview):
    db = next(get_db())
    record = db.query(InventoryRecord).filter(InventoryRecord.batch_number == review.batch_number).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"批次号 {review.batch_number} 不存在")
    if record.status != "pending":
        raise HTTPException(status_code=400, detail="该记录已复核，无法重复复核")
    if review.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="状态只能是 approved 或 rejected")
    record.status = review.status
    record.reviewed_by = review.reviewed_by
    record.review_time = datetime.utcnow()
    record.review_notes = review.review_notes
    db.commit()
    db.refresh(record)
    return record

@app.get("/api/inventory/export", summary="导出Excel报告")
def export_inventory(
    receiver: Optional[str] = Query(None),
    reviewed_by: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    temperature_status: Optional[str] = Query(None),
    product_type: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None)
):
    db = next(get_db())
    query = db.query(InventoryRecord)
    if receiver:
        query = query.filter(InventoryRecord.receiver == receiver)
    if reviewed_by:
        query = query.filter(InventoryRecord.reviewed_by == reviewed_by)
    if status:
        query = query.filter(InventoryRecord.status == status)
    if temperature_status:
        query = query.filter(InventoryRecord.temperature_status == temperature_status)
    if product_type:
        query = query.filter(InventoryRecord.product_type == product_type)
    if start_time:
        query = query.filter(InventoryRecord.arrival_time >= start_time)
    if end_time:
        query = query.filter(InventoryRecord.arrival_time <= end_time)
    records = query.order_by(InventoryRecord.arrival_time.desc()).all()
    data = []
    for r in records:
        data.append({
            "批次号": r.batch_number,
            "产品名称": r.product_name,
            "产品类型": r.product_type,
            "到店时间": r.arrival_time.strftime("%Y-%m-%d %H:%M:%S"),
            "温度(℃)": r.temperature,
            "温度状态": "正常" if r.temperature_status == "normal" else "异常",
            "签收人": r.receiver,
            "是否破损": "是" if r.has_damage else "否",
            "破损描述": r.damage_description or "",
            "状态": "待复核" if r.status == "pending" else "已通过" if r.status == "approved" else "已拒绝",
            "复核人": r.reviewed_by or "",
            "复核时间": r.review_time.strftime("%Y-%m-%d %H:%M:%S") if r.review_time else "",
            "复核备注": r.review_notes or ""
        })
    df = pd.DataFrame(data)
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
        tmp_path = tmp.name
    df.to_excel(tmp_path, index=False, sheet_name="库存记录")
    filename = f"库存记录_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return FileResponse(tmp_path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=filename)

@app.get("/api/inventory/{batch_number}", response_model=InventoryResponse, summary="查询单条记录")
def get_single_inventory(batch_number: str):
    db = next(get_db())
    record = db.query(InventoryRecord).filter(InventoryRecord.batch_number == batch_number).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"批次号 {batch_number} 不存在")
    return record

@app.get("/api/stats", summary="统计摘要")
def get_stats():
    db = next(get_db())
    total = db.query(InventoryRecord).count()
    pending = db.query(InventoryRecord).filter(InventoryRecord.status == "pending").count()
    approved = db.query(InventoryRecord).filter(InventoryRecord.status == "approved").count()
    rejected = db.query(InventoryRecord).filter(InventoryRecord.status == "rejected").count()
    temp_abnormal = db.query(InventoryRecord).filter(InventoryRecord.temperature_status == "abnormal").count()
    has_damage = db.query(InventoryRecord).filter(InventoryRecord.has_damage == True).count()
    return {
        "总记录数": total,
        "待复核": pending,
        "已通过": approved,
        "已拒绝": rejected,
        "温度异常": temp_abnormal,
        "存在破损": has_damage
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
