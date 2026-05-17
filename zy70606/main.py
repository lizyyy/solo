from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import enum
from sqlalchemy import Enum as SQLEnum

DATABASE_URL = "sqlite:///./spare_parts.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class WorkOrderStatus(str, enum.Enum):
    CREATED = "created"
    ASSIGNED = "assigned"
    DISPATCHED = "dispatched"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REASSIGNED = "reassigned"

class PreemptStatus(str, enum.Enum):
    ACTIVE = "active"
    RELEASED = "released"
    CONSUMED = "consumed"
    EXPIRED = "expired"

class ReleaseReason(str, enum.Enum):
    TIMEOUT = "timeout"
    REASSIGNED = "reassigned"
    CANCELLED = "cancelled"
    MANUAL = "manual"
    ERROR_CORRECTION = "error_correction"

class ErrorCode(str, enum.Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEEDS_REVIEW = "needs_review"
    ALREADY_PROCESSED = "already_processed"
    INSUFFICIENT_STOCK = "insufficient_stock"
    NOT_FOUND = "not_found"

class Engineer(Base):
    __tablename__ = "engineers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    phone = Column(String)
    email = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    schedules = relationship("EngineerSchedule", back_populates="engineer")
    work_orders = relationship("WorkOrder", back_populates="engineer")

class EngineerSchedule(Base):
    __tablename__ = "engineer_schedules"
    id = Column(Integer, primary_key=True, index=True)
    engineer_id = Column(Integer, ForeignKey("engineers.id"))
    schedule_date = Column(DateTime, index=True)
    shift_start = Column(DateTime)
    shift_end = Column(DateTime)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    engineer = relationship("Engineer", back_populates="schedules")

class SparePart(Base):
    __tablename__ = "spare_parts"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    category = Column(String)
    total_stock = Column(Integer, default=0)
    available_stock = Column(Integer, default=0)
    reserved_stock = Column(Integer, default=0)
    unit = Column(String)
    location = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    preemptions = relationship("SparePartPreemption", back_populates="spare_part")

class WorkOrder(Base):
    __tablename__ = "work_orders"
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True)
    customer_name = Column(String)
    customer_phone = Column(String)
    address = Column(String)
    issue_description = Column(Text)
    status = Column(SQLEnum(WorkOrderStatus), default=WorkOrderStatus.CREATED)
    engineer_id = Column(Integer, ForeignKey("engineers.id"), nullable=True)
    scheduled_date = Column(DateTime)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    engineer = relationship("Engineer", back_populates="work_orders")
    preemptions = relationship("SparePartPreemption", back_populates="work_order")

class SparePartPreemption(Base):
    __tablename__ = "spare_part_preemptions"
    id = Column(Integer, primary_key=True, index=True)
    preemption_no = Column(String, unique=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    spare_part_id = Column(Integer, ForeignKey("spare_parts.id"))
    engineer_id = Column(Integer, ForeignKey("engineers.id"))
    quantity = Column(Integer)
    status = Column(SQLEnum(PreemptStatus), default=PreemptStatus.ACTIVE)
    release_reason = Column(SQLEnum(ReleaseReason), nullable=True)
    release_note = Column(Text, nullable=True)
    released_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    work_order = relationship("WorkOrder", back_populates="preemptions")
    spare_part = relationship("SparePart", back_populates="preemptions")

class FulfillmentSummary(Base):
    __tablename__ = "fulfillment_summaries"
    id = Column(Integer, primary_key=True, index=True)
    summary_date = Column(DateTime, index=True)
    total_work_orders = Column(Integer, default=0)
    total_preemptions = Column(Integer, default=0)
    successful_fulfillments = Column(Integer, default=0)
    timeout_releases = Column(Integer, default=0)
    reassigned_releases = Column(Integer, default=0)
    manual_releases = Column(Integer, default=0)
    rework_count = Column(Integer, default=0)
    avg_fulfillment_time = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="备件预占改派释放履约摘要API", version="1.0.0")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[Dict[str, Any]] = None

def create_error_response(error_code: ErrorCode, message: str, details: Optional[Dict] = None, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={"error_code": error_code.value, "message": message, "details": details}
    )

class EngineerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None

class EngineerResponse(BaseModel):
    id: int
    name: str
    phone: str
    email: Optional[str]
    is_active: bool

    class Config:
        orm_mode = True

class SparePartCreate(BaseModel):
    sku: str
    name: str
    category: Optional[str] = None
    total_stock: int = 0
    unit: Optional[str] = None
    location: Optional[str] = None

class SparePartResponse(BaseModel):
    id: int
    sku: str
    name: str
    category: Optional[str]
    total_stock: int
    available_stock: int
    reserved_stock: int
    unit: Optional[str]
    location: Optional[str]

    class Config:
        orm_mode = True

class WorkOrderCreate(BaseModel):
    order_no: str
    customer_name: str
    customer_phone: str
    address: str
    issue_description: str
    scheduled_date: Optional[datetime] = None

class WorkOrderResponse(BaseModel):
    id: int
    order_no: str
    customer_name: str
    customer_phone: str
    address: str
    issue_description: str
    status: WorkOrderStatus
    engineer_id: Optional[int]
    scheduled_date: Optional[datetime]

    class Config:
        orm_mode = True

class PreemptionCreate(BaseModel):
    work_order_id: int
    spare_part_id: int
    engineer_id: int
    quantity: int
    expiration_hours: Optional[int] = 24

class PreemptionResponse(BaseModel):
    id: int
    preemption_no: str
    work_order_id: int
    spare_part_id: int
    engineer_id: int
    quantity: int
    status: PreemptStatus
    expires_at: datetime
    created_at: datetime

    class Config:
        orm_mode = True

class ReleaseRequest(BaseModel):
    preemption_id: int
    release_reason: ReleaseReason
    release_note: Optional[str] = None

class ReassignRequest(BaseModel):
    work_order_id: int
    new_engineer_id: int
    note: Optional[str] = None

class FulfillmentSummaryResponse(BaseModel):
    id: int
    summary_date: datetime
    total_work_orders: int
    total_preemptions: int
    successful_fulfillments: int
    timeout_releases: int
    reassigned_releases: int
    manual_releases: int
    rework_count: int
    avg_fulfillment_time: float

    class Config:
        orm_mode = True

@app.post("/engineers/", response_model=EngineerResponse)
def create_engineer(engineer: EngineerCreate, db: Session = Depends(get_db)):
    db_engineer = Engineer(**engineer.dict())
    db.add(db_engineer)
    db.commit()
    db.refresh(db_engineer)
    return db_engineer

@app.get("/engineers/", response_model=List[EngineerResponse])
def list_engineers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Engineer).offset(skip).limit(limit).all()

@app.post("/spare-parts/", response_model=SparePartResponse)
def create_spare_part(part: SparePartCreate, db: Session = Depends(get_db)):
    existing = db.query(SparePart).filter(SparePart.sku == part.sku).first()
    if existing:
        return create_error_response(ErrorCode.ALREADY_PROCESSED, f"SKU {part.sku} 已存在")
    db_part = SparePart(**part.dict(), available_stock=part.total_stock)
    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    return db_part

@app.get("/spare-parts/", response_model=List[SparePartResponse])
def list_spare_parts(skip: int = 0, limit: int = 100, category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(SparePart)
    if category:
        query = query.filter(SparePart.category == category)
    return query.offset(skip).limit(limit).all()

@app.post("/work-orders/", response_model=WorkOrderResponse)
def create_work_order(order: WorkOrderCreate, db: Session = Depends(get_db)):
    existing = db.query(WorkOrder).filter(WorkOrder.order_no == order.order_no).first()
    if existing:
        return create_error_response(ErrorCode.ALREADY_PROCESSED, f"工单号 {order.order_no} 已存在")
    db_order = WorkOrder(**order.dict())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

@app.get("/work-orders/", response_model=List[WorkOrderResponse])
def list_work_orders(skip: int = 0, limit: int = 100, status: Optional[WorkOrderStatus] = None, 
                     engineer_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(WorkOrder)
    if status:
        query = query.filter(WorkOrder.status == status)
    if engineer_id:
        query = query.filter(WorkOrder.engineer_id == engineer_id)
    return query.offset(skip).limit(limit).all()

@app.post("/preemptions/", response_model=PreemptionResponse)
def create_preemption(preemption: PreemptionCreate, db: Session = Depends(get_db)):
    work_order = db.query(WorkOrder).filter(WorkOrder.id == preemption.work_order_id).first()
    if not work_order:
        return create_error_response(ErrorCode.NOT_FOUND, "工单不存在", status_code=404)
    
    spare_part = db.query(SparePart).filter(SparePart.id == preemption.spare_part_id).first()
    if not spare_part:
        return create_error_response(ErrorCode.NOT_FOUND, "备件不存在", status_code=404)
    
    engineer = db.query(Engineer).filter(Engineer.id == preemption.engineer_id).first()
    if not engineer:
        return create_error_response(ErrorCode.NOT_FOUND, "工程师不存在", status_code=404)
    
    if work_order.status not in [WorkOrderStatus.CREATED, WorkOrderStatus.ASSIGNED, WorkOrderStatus.REASSIGNED]:
        return create_error_response(ErrorCode.INVALID_STATUS, f"工单状态 {work_order.status} 不允许预占")
    
    active_preemptions = db.query(SparePartPreemption).filter(
        SparePartPreemption.work_order_id == preemption.work_order_id,
        SparePartPreemption.spare_part_id == preemption.spare_part_id,
        SparePartPreemption.status == PreemptStatus.ACTIVE
    ).first()
    
    if active_preemptions:
        return create_error_response(ErrorCode.ALREADY_PROCESSED, "该工单此备件已有活跃预占记录")
    
    if spare_part.available_stock < preemption.quantity:
        return create_error_response(ErrorCode.INSUFFICIENT_STOCK, "库存不足", 
                                    {"available": spare_part.available_stock, "requested": preemption.quantity})
    
    spare_part.available_stock -= preemption.quantity
    spare_part.reserved_stock += preemption.quantity
    
    preemption_no = f"PRE-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{preemption.work_order_id}"
    expires_at = datetime.utcnow() + timedelta(hours=preemption.expiration_hours)
    
    db_preemption = SparePartPreemption(
        preemption_no=preemption_no,
        work_order_id=preemption.work_order_id,
        spare_part_id=preemption.spare_part_id,
        engineer_id=preemption.engineer_id,
        quantity=preemption.quantity,
        expires_at=expires_at
    )
    
    db.add(db_preemption)
    
    if work_order.status == WorkOrderStatus.CREATED:
        work_order.status = WorkOrderStatus.ASSIGNED
        work_order.engineer_id = preemption.engineer_id
    
    db.commit()
    db.refresh(db_preemption)
    return db_preemption

@app.post("/preemptions/release/")
def release_preemption(request: ReleaseRequest, db: Session = Depends(get_db)):
    preemption = db.query(SparePartPreemption).filter(SparePartPreemption.id == request.preemption_id).first()
    if not preemption:
        return create_error_response(ErrorCode.NOT_FOUND, "预占记录不存在", status_code=404)
    
    if preemption.status != PreemptStatus.ACTIVE:
        return create_error_response(ErrorCode.INVALID_STATUS, f"预占状态 {preemption.status} 不允许释放")
    
    spare_part = db.query(SparePart).filter(SparePart.id == preemption.spare_part_id).first()
    if spare_part:
        spare_part.available_stock += preemption.quantity
        spare_part.reserved_stock -= preemption.quantity
    
    preemption.status = PreemptStatus.RELEASED
    preemption.release_reason = request.release_reason
    preemption.release_note = request.release_note
    preemption.released_at = datetime.utcnow()
    
    db.commit()
    return {"message": "释放成功", "preemption_id": preemption.id, "status": PreemptStatus.RELEASED}

@app.post("/work-orders/reassign/")
def reassign_work_order(request: ReassignRequest, db: Session = Depends(get_db)):
    work_order = db.query(WorkOrder).filter(WorkOrder.id == request.work_order_id).first()
    if not work_order:
        return create_error_response(ErrorCode.NOT_FOUND, "工单不存在", status_code=404)
    
    if work_order.status == WorkOrderStatus.COMPLETED:
        return create_error_response(ErrorCode.INVALID_STATUS, "已完成工单不能改派")
    
    new_engineer = db.query(Engineer).filter(Engineer.id == request.new_engineer_id).first()
    if not new_engineer:
        return create_error_response(ErrorCode.NOT_FOUND, "新工程师不存在", status_code=404)
    
    active_preemptions = db.query(SparePartPreemption).filter(
        SparePartPreemption.work_order_id == request.work_order_id,
        SparePartPreemption.status == PreemptStatus.ACTIVE
    ).all()
    
    for preemption in active_preemptions:
        spare_part = db.query(SparePart).filter(SparePart.id == preemption.spare_part_id).first()
        if spare_part:
            spare_part.available_stock += preemption.quantity
            spare_part.reserved_stock -= preemption.quantity
        
        preemption.status = PreemptStatus.RELEASED
        preemption.release_reason = ReleaseReason.REASSIGNED
        preemption.release_note = f"工单改派: {request.note or '无备注'}"
        preemption.released_at = datetime.utcnow()
    
    old_engineer_id = work_order.engineer_id
    work_order.engineer_id = request.new_engineer_id
    work_order.status = WorkOrderStatus.REASSIGNED
    
    db.commit()
    
    return {
        "message": "改派成功",
        "work_order_id": work_order.id,
        "old_engineer_id": old_engineer_id,
        "new_engineer_id": request.new_engineer_id,
        "released_preemptions_count": len(active_preemptions)
    }

@app.post("/preemptions/check-timeout/")
def check_timeout_preemptions(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    expired_preemptions = db.query(SparePartPreemption).filter(
        SparePartPreemption.status == PreemptStatus.ACTIVE,
        SparePartPreemption.expires_at <= now
    ).all()
    
    for preemption in expired_preemptions:
        spare_part = db.query(SparePart).filter(SparePart.id == preemption.spare_part_id).first()
        if spare_part:
            spare_part.available_stock += preemption.quantity
            spare_part.reserved_stock -= preemption.quantity
        
        preemption.status = PreemptStatus.EXPIRED
        preemption.release_reason = ReleaseReason.TIMEOUT
        preemption.released_at = now
    
    db.commit()
    return {"message": "超时检查完成", "expired_count": len(expired_preemptions)}

@app.post("/preemptions/consume/")
def consume_preemption(preemption_id: int, db: Session = Depends(get_db)):
    preemption = db.query(SparePartPreemption).filter(SparePartPreemption.id == preemption_id).first()
    if not preemption:
        return create_error_response(ErrorCode.NOT_FOUND, "预占记录不存在", status_code=404)
    
    if preemption.status != PreemptStatus.ACTIVE:
        return create_error_response(ErrorCode.INVALID_STATUS, f"预占状态 {preemption.status} 不允许扣减")
    
    now = datetime.utcnow()
    if preemption.expires_at <= now:
        return create_error_response(ErrorCode.NEEDS_REVIEW, "预占已超时，请先确认是否继续使用")
    
    spare_part = db.query(SparePart).filter(SparePart.id == preemption.spare_part_id).first()
    if spare_part:
        if spare_part.reserved_stock < preemption.quantity:
            return create_error_response(ErrorCode.INSUFFICIENT_STOCK, "预占库存异常，需要人工复核")
        spare_part.reserved_stock -= preemption.quantity
        spare_part.total_stock -= preemption.quantity
    
    preemption.status = PreemptStatus.CONSUMED
    db.commit()
    return {"message": "扣减成功", "preemption_id": preemption.id}

@app.get("/fulfillment/summary/", response_model=FulfillmentSummaryResponse)
def get_fulfillment_summary(start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, 
                            db: Session = Depends(get_db)):
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()
    
    total_work_orders = db.query(WorkOrder).filter(
        WorkOrder.created_at >= start_date,
        WorkOrder.created_at <= end_date
    ).count()
    
    total_preemptions = db.query(SparePartPreemption).filter(
        SparePartPreemption.created_at >= start_date,
        SparePartPreemption.created_at <= end_date
    ).count()
    
    successful_fulfillments = db.query(SparePartPreemption).filter(
        SparePartPreemption.created_at >= start_date,
        SparePartPreemption.created_at <= end_date,
        SparePartPreemption.status == PreemptStatus.CONSUMED
    ).count()
    
    timeout_releases = db.query(SparePartPreemption).filter(
        SparePartPreemption.released_at >= start_date,
        SparePartPreemption.released_at <= end_date,
        SparePartPreemption.release_reason == ReleaseReason.TIMEOUT
    ).count()
    
    reassigned_releases = db.query(SparePartPreemption).filter(
        SparePartPreemption.released_at >= start_date,
        SparePartPreemption.released_at <= end_date,
        SparePartPreemption.release_reason == ReleaseReason.REASSIGNED
    ).count()
    
    manual_releases = db.query(SparePartPreemption).filter(
        SparePartPreemption.released_at >= start_date,
        SparePartPreemption.released_at <= end_date,
        SparePartPreemption.release_reason == ReleaseReason.MANUAL
    ).count()
    
    rework_count = db.query(WorkOrder).filter(
        WorkOrder.created_at >= start_date,
        WorkOrder.created_at <= end_date,
        WorkOrder.status == WorkOrderStatus.REASSIGNED
    ).count()
    
    return {
        "id": 0,
        "summary_date": datetime.utcnow(),
        "total_work_orders": total_work_orders,
        "total_preemptions": total_preemptions,
        "successful_fulfillments": successful_fulfillments,
        "timeout_releases": timeout_releases,
        "reassigned_releases": reassigned_releases,
        "manual_releases": manual_releases,
        "rework_count": rework_count,
        "avg_fulfillment_time": 0.0
    }

@app.get("/preemptions/", response_model=List[PreemptionResponse])
def list_preemptions(skip: int = 0, limit: int = 100, status: Optional[PreemptStatus] = None,
                     work_order_id: Optional[int] = None, engineer_id: Optional[int] = None,
                     db: Session = Depends(get_db)):
    query = db.query(SparePartPreemption)
    if status:
        query = query.filter(SparePartPreemption.status == status)
    if work_order_id:
        query = query.filter(SparePartPreemption.work_order_id == work_order_id)
    if engineer_id:
        query = query.filter(SparePartPreemption.engineer_id == engineer_id)
    return query.offset(skip).limit(limit).all()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
