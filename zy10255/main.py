from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, func, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid
import hashlib

DATABASE_URL = "sqlite:///./apartment_meter.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class MeterType(str, Enum):
    WATER = "water"
    ELECTRICITY = "electricity"

class ReadingStatus(str, Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    REVOKED = "revoked"

class BillStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PAID = "paid"
    REVOKED = "revoked"

class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, unique=True, index=True, nullable=False)
    floor = Column(Integer)
    building = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    tenants = relationship("Tenant", back_populates="room")
    meter_readings = relationship("MeterReading", back_populates="room")
    bills = relationship("Bill", back_populates="room")

class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String)
    id_card = Column(String, unique=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    move_in_date = Column(DateTime)
    move_out_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    room = relationship("Room", back_populates="tenants")
    precharges = relationship("Precharge", back_populates="tenant")
    bills = relationship("Bill", back_populates="tenant")

class Price(Base):
    __tablename__ = "prices"
    id = Column(Integer, primary_key=True, index=True)
    meter_type = Column(String, nullable=False)
    unit_price = Column(Float, nullable=False)
    effective_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)

class MeterReading(Base):
    __tablename__ = "meter_readings"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    meter_type = Column(String, nullable=False)
    reading_value = Column(Float, nullable=False)
    reading_date = Column(DateTime, nullable=False)
    previous_reading_id = Column(Integer, ForeignKey("meter_readings.id"))
    status = Column(String, default=ReadingStatus.DRAFT)
    request_idempotency_key = Column(String, unique=True, index=True)
    is_revision = Column(Boolean, default=False)
    original_reading_id = Column(Integer, ForeignKey("meter_readings.id"))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)
    room = relationship("Room", back_populates="meter_readings")
    bill_items = relationship("BillItem", back_populates="reading")

class Precharge(Base):
    __tablename__ = "precharges"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    amount = Column(Float, nullable=False)
    charge_date = Column(DateTime, default=datetime.utcnow)
    request_idempotency_key = Column(String, unique=True, index=True)
    payment_method = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    tenant = relationship("Tenant", back_populates="precharges")

class TenantTransfer(Base):
    __tablename__ = "tenant_transfers"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    old_tenant_id = Column(Integer, ForeignKey("tenants.id"))
    new_tenant_id = Column(Integer, ForeignKey("tenants.id"))
    transfer_date = Column(DateTime, nullable=False)
    water_reading = Column(Float)
    electricity_reading = Column(Float)
    is_confirmed = Column(Boolean, default=False)
    confirmed_at = Column(DateTime)
    request_idempotency_key = Column(String, unique=True, index=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class Bill(Base):
    __tablename__ = "bills"
    id = Column(Integer, primary_key=True, index=True)
    bill_no = Column(String, unique=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    status = Column(String, default=BillStatus.PENDING)
    total_amount = Column(Float, default=0)
    paid_amount = Column(Float, default=0)
    balance = Column(Float, default=0)
    is_transfer_split = Column(Boolean, default=False)
    transfer_id = Column(Integer, ForeignKey("tenant_transfers.id"))
    confirmed_at = Column(DateTime)
    request_idempotency_key = Column(String, unique=True, index=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    room = relationship("Room", back_populates="bills")
    tenant = relationship("Tenant", back_populates="bills")
    items = relationship("BillItem", back_populates="bill")
    
    __table_args__ = (
        UniqueConstraint('room_id', 'tenant_id', 'period_start', 'period_end', 'transfer_id', 
                         name='_bill_unique_constraint'),
    )

class BillItem(Base):
    __tablename__ = "bill_items"
    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"))
    meter_type = Column(String, nullable=False)
    reading_id = Column(Integer, ForeignKey("meter_readings.id"))
    previous_reading = Column(Float)
    current_reading = Column(Float)
    usage = Column(Float)
    unit_price = Column(Float)
    amount = Column(Float)
    days_in_period = Column(Integer)
    transfer_split_ratio = Column(Float, default=1.0)
    bill = relationship("Bill", back_populates="items")
    reading = relationship("MeterReading", back_populates="bill_items")

class BillHistory(Base):
    __tablename__ = "bill_history"
    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"))
    action = Column(String, nullable=False)
    old_status = Column(String)
    new_status = Column(String)
    old_amount = Column(Float)
    new_amount = Column(Float)
    operator = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="公寓水电抄表 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_idempotency_key(*args) -> str:
    content = "|".join(str(arg) for arg in args)
    return hashlib.md5(content.encode()).hexdigest()

class RoomCreate(BaseModel):
    room_number: str
    floor: Optional[int] = None
    building: Optional[str] = None

class RoomResponse(BaseModel):
    id: int
    room_number: str
    floor: Optional[int]
    building: Optional[str]
    is_active: bool

    class Config:
        orm_mode = True

class TenantCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    id_card: Optional[str] = None
    room_id: int
    move_in_date: datetime

class TenantResponse(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    room_id: int
    move_in_date: datetime
    move_out_date: Optional[datetime]
    is_active: bool

    class Config:
        orm_mode = True

class PriceCreate(BaseModel):
    meter_type: MeterType
    unit_price: float
    effective_date: datetime
    end_date: Optional[datetime] = None

class PriceResponse(BaseModel):
    id: int
    meter_type: str
    unit_price: float
    effective_date: datetime
    end_date: Optional[datetime]
    is_active: bool

    class Config:
        orm_mode = True

class MeterReadingCreate(BaseModel):
    room_id: int
    meter_type: MeterType
    reading_value: float
    reading_date: datetime
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None

class MeterReadingResponse(BaseModel):
    id: int
    room_id: int
    meter_type: str
    reading_value: float
    reading_date: datetime
    status: str
    notes: Optional[str]

    class Config:
        orm_mode = True

class PrechargeCreate(BaseModel):
    tenant_id: int
    amount: float
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None

class PrechargeResponse(BaseModel):
    id: int
    tenant_id: int
    amount: float
    charge_date: datetime
    payment_method: Optional[str]

    class Config:
        orm_mode = True

class TenantTransferCreate(BaseModel):
    room_id: int
    old_tenant_id: int
    new_tenant_id: int
    transfer_date: datetime
    water_reading: Optional[float] = None
    electricity_reading: Optional[float] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None

class TenantTransferResponse(BaseModel):
    id: int
    room_id: int
    old_tenant_id: int
    new_tenant_id: int
    transfer_date: datetime
    is_confirmed: bool
    water_reading: Optional[float]
    electricity_reading: Optional[float]

    class Config:
        orm_mode = True

class BillConfirmRequest(BaseModel):
    bill_id: int
    notes: Optional[str] = None

class BillResponse(BaseModel):
    id: int
    bill_no: str
    room_id: int
    tenant_id: int
    period_start: datetime
    period_end: datetime
    status: str
    total_amount: float
    paid_amount: float
    balance: float
    is_transfer_split: bool

    class Config:
        orm_mode = True

class BillItemResponse(BaseModel):
    id: int
    meter_type: str
    previous_reading: float
    current_reading: float
    usage: float
    unit_price: float
    amount: float
    transfer_split_ratio: float

    class Config:
        orm_mode = True

class BillDetailResponse(BaseModel):
    bill: BillResponse
    items: List[BillItemResponse]

    class Config:
        orm_mode = True

@app.post("/api/rooms", response_model=RoomResponse)
def create_room(room: RoomCreate, db: Session = Depends(get_db)):
    existing = db.query(Room).filter(Room.room_number == room.room_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="房间号已存在")
    db_room = Room(**room.dict())
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room

@app.get("/api/rooms", response_model=List[RoomResponse])
def list_rooms(db: Session = Depends(get_db)):
    return db.query(Room).all()

@app.post("/api/tenants", response_model=TenantResponse)
def create_tenant(tenant: TenantCreate, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == tenant.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")
    db_tenant = Tenant(**tenant.dict())
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

@app.get("/api/tenants", response_model=List[TenantResponse])
def list_tenants(room_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Tenant)
    if room_id:
        query = query.filter(Tenant.room_id == room_id)
    return query.all()

@app.post("/api/prices", response_model=PriceResponse)
def create_price(price: PriceCreate, db: Session = Depends(get_db)):
    db.query(Price).filter(
        Price.meter_type == price.meter_type,
        Price.is_active == True
    ).update({"is_active": False, "end_date": price.effective_date})
    db_price = Price(**price.dict())
    db.add(db_price)
    db.commit()
    db.refresh(db_price)
    return db_price

@app.get("/api/prices", response_model=List[PriceResponse])
def list_prices(meter_type: Optional[MeterType] = None, db: Session = Depends(get_db)):
    query = db.query(Price)
    if meter_type:
        query = query.filter(Price.meter_type == meter_type)
    return query.order_by(Price.effective_date.desc()).all()

def get_previous_reading(db: Session, room_id: int, meter_type: str, reading_date: datetime):
    return db.query(MeterReading).filter(
        MeterReading.room_id == room_id,
        MeterReading.meter_type == meter_type,
        MeterReading.reading_date < reading_date,
        MeterReading.status == "confirmed"
    ).order_by(MeterReading.reading_date.desc()).first()

@app.post("/api/meter-readings", response_model=MeterReadingResponse)
def create_meter_reading(reading: MeterReadingCreate, db: Session = Depends(get_db)):
    idempotency_key = reading.idempotency_key or generate_idempotency_key(
        reading.room_id, reading.meter_type, reading.reading_value, reading.reading_date
    )
    existing = db.query(MeterReading).filter(
        MeterReading.request_idempotency_key == idempotency_key
    ).first()
    if existing:
        return existing
    room = db.query(Room).filter(Room.id == reading.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")
    prev_reading = get_previous_reading(db, reading.room_id, reading.meter_type, reading.reading_date)
    if prev_reading and reading.reading_value < prev_reading.reading_value:
        raise HTTPException(status_code=400, detail="读数不能小于上次抄表值")
    db_reading = MeterReading(
        **reading.dict(exclude={"idempotency_key"}),
        request_idempotency_key=idempotency_key,
        previous_reading_id=prev_reading.id if prev_reading else None
    )
    db.add(db_reading)
    db.commit()
    db.refresh(db_reading)
    return db_reading

@app.get("/api/meter-readings", response_model=List[MeterReadingResponse])
def list_meter_readings(room_id: Optional[int] = None, meter_type: Optional[MeterType] = None, db: Session = Depends(get_db)):
    query = db.query(MeterReading)
    if room_id:
        query = query.filter(MeterReading.room_id == room_id)
    if meter_type:
        query = query.filter(MeterReading.meter_type == meter_type)
    return query.order_by(MeterReading.reading_date.desc()).all()

@app.post("/api/meter-readings/{reading_id}/confirm")
def confirm_meter_reading(reading_id: int, db: Session = Depends(get_db)):
    reading = db.query(MeterReading).filter(MeterReading.id == reading_id).first()
    if not reading:
        raise HTTPException(status_code=404, detail="抄表记录不存在")
    if reading.status == "confirmed":
        return {"message": "已确认", "status": reading.status}
    if reading.status == "revoked":
        raise HTTPException(status_code=400, detail="已撤销的记录不能确认")
    reading.status = "confirmed"
    db.commit()
    return {"message": "确认成功", "status": reading.status}

@app.post("/api/meter-readings/{reading_id}/revoke")
def revoke_meter_reading(reading_id: int, db: Session = Depends(get_db)):
    reading = db.query(MeterReading).filter(MeterReading.id == reading_id).first()
    if not reading:
        raise HTTPException(status_code=404, detail="抄表记录不存在")
    if reading.status == "revoked":
        return {"message": "已撤销", "status": reading.status}
    linked_bill = db.query(BillItem).filter(BillItem.reading_id == reading_id).first()
    if linked_bill:
        bill = db.query(Bill).filter(Bill.id == linked_bill.bill_id).first()
        if bill and bill.status == "confirmed":
            raise HTTPException(status_code=400, detail="该抄表已关联确认账单，无法撤销")
    reading.status = "revoked"
    db.commit()
    return {"message": "撤销成功", "status": reading.status}

@app.post("/api/precharges", response_model=PrechargeResponse)
def create_precharge(precharge: PrechargeCreate, db: Session = Depends(get_db)):
    idempotency_key = precharge.idempotency_key or generate_idempotency_key(
        precharge.tenant_id, precharge.amount, datetime.now().date()
    )
    existing = db.query(Precharge).filter(
        Precharge.request_idempotency_key == idempotency_key
    ).first()
    if existing:
        return existing
    tenant = db.query(Tenant).filter(Tenant.id == precharge.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="租客不存在")
    db_precharge = Precharge(
        **precharge.dict(exclude={"idempotency_key"}),
        request_idempotency_key=idempotency_key
    )
    db.add(db_precharge)
    db.commit()
    db.refresh(db_precharge)
    return db_precharge

@app.get("/api/precharges")
def list_precharges(tenant_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Precharge)
    if tenant_id:
        query = query.filter(Precharge.tenant_id == tenant_id)
    return query.order_by(Precharge.charge_date.desc()).all()

@app.get("/api/tenants/{tenant_id}/balance")
def get_tenant_balance(tenant_id: int, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="租客不存在")
    total_precharge = db.query(func.sum(Precharge.amount)).filter(Precharge.tenant_id == tenant_id).scalar() or 0
    total_bill = db.query(func.sum(Bill.total_amount)).filter(
        Bill.tenant_id == tenant_id,
        Bill.status.in_(["confirmed", "paid"])
    ).scalar() or 0
    total_paid = db.query(func.sum(Bill.paid_amount)).filter(
        Bill.tenant_id == tenant_id,
        Bill.status == "paid"
    ).scalar() or 0
    balance = total_precharge - total_bill
    return {
        "tenant_id": tenant_id,
        "total_precharge": total_precharge,
        "total_bill": total_bill,
        "balance": balance,
        "insufficient": balance < 0
    }

@app.post("/api/tenant-transfers", response_model=TenantTransferResponse)
def create_tenant_transfer(transfer: TenantTransferCreate, db: Session = Depends(get_db)):
    idempotency_key = transfer.idempotency_key or generate_idempotency_key(
        transfer.room_id, transfer.old_tenant_id, transfer.new_tenant_id, transfer.transfer_date
    )
    existing = db.query(TenantTransfer).filter(
        TenantTransfer.request_idempotency_key == idempotency_key
    ).first()
    if existing:
        return existing
    old_tenant = db.query(Tenant).filter(Tenant.id == transfer.old_tenant_id).first()
    new_tenant = db.query(Tenant).filter(Tenant.id == transfer.new_tenant_id).first()
    if not old_tenant or not new_tenant:
        raise HTTPException(status_code=404, detail="租客不存在")
    db_transfer = TenantTransfer(
        **transfer.dict(exclude={"idempotency_key"}),
        request_idempotency_key=idempotency_key
    )
    db.add(db_transfer)
    db.commit()
    db.refresh(db_transfer)
    return db_transfer

@app.post("/api/tenant-transfers/{transfer_id}/confirm")
def confirm_tenant_transfer(transfer_id: int, db: Session = Depends(get_db)):
    transfer = db.query(TenantTransfer).filter(TenantTransfer.id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="换租记录不存在")
    if transfer.is_confirmed:
        return {"message": "已确认", "is_confirmed": True}
    transfer.is_confirmed = True
    transfer.confirmed_at = datetime.utcnow()
    old_tenant = db.query(Tenant).filter(Tenant.id == transfer.old_tenant_id).first()
    if old_tenant:
        old_tenant.move_out_date = transfer.transfer_date
        old_tenant.is_active = False
    db.commit()
    return {"message": "确认成功", "is_confirmed": True}

def get_price_at_date(db: Session, meter_type: str, target_date: datetime) -> float:
    price = db.query(Price).filter(
        Price.meter_type == meter_type,
        Price.effective_date <= target_date
    ).order_by(Price.effective_date.desc()).first()
    return price.unit_price if price else 0

def calculate_days_between(start: datetime, end: datetime) -> int:
    return (end.date() - start.date()).days

@app.post("/api/bills/generate")
def generate_bill(
    room_id: int,
    tenant_id: int,
    period_start: datetime,
    period_end: datetime,
    transfer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    room = db.query(Room).filter(Room.id == room_id).first()
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not room or not tenant:
        raise HTTPException(status_code=404, detail="房间或租客不存在")
    
    existing_bill = db.query(Bill).filter(
        Bill.room_id == room_id,
        Bill.tenant_id == tenant_id,
        Bill.period_start == period_start,
        Bill.period_end == period_end,
        Bill.transfer_id == transfer_id
    ).first()
    if existing_bill:
        return {
            "bill_id": existing_bill.id,
            "bill_no": existing_bill.bill_no,
            "total_amount": existing_bill.total_amount,
            "status": existing_bill.status,
            "is_existing": True
        }
    
    bill_no = f"BILL-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    bill = Bill(
        bill_no=bill_no,
        room_id=room_id,
        tenant_id=tenant_id,
        period_start=period_start,
        period_end=period_end,
        is_transfer_split=transfer_id is not None,
        transfer_id=transfer_id
    )
    db.add(bill)
    db.flush()
    total_amount = 0
    transfer = db.query(TenantTransfer).filter(TenantTransfer.id == transfer_id).first() if transfer_id else None
    
    is_old_tenant = False
    is_new_tenant = False
    if transfer and transfer.is_confirmed:
        is_old_tenant = (tenant_id == transfer.old_tenant_id)
        is_new_tenant = (tenant_id == transfer.new_tenant_id)
    
    for meter_type in [MeterType.WATER, MeterType.ELECTRICITY]:
        readings = db.query(MeterReading).filter(
            MeterReading.room_id == room_id,
            MeterReading.meter_type == meter_type,
            MeterReading.reading_date >= period_start,
            MeterReading.reading_date <= period_end,
            MeterReading.status == "confirmed"
        ).order_by(MeterReading.reading_date).all()
        if not readings:
            continue
        prev_reading = get_previous_reading(db, room_id, meter_type, period_start)
        if not prev_reading and readings:
            prev_reading = readings[0]
        if prev_reading:
            current_reading = readings[-1]
            total_usage = current_reading.reading_value - prev_reading.reading_value
            unit_price = get_price_at_date(db, meter_type, period_end)
            days_in_period = calculate_days_between(period_start, period_end)
            
            split_ratio = 1.0
            actual_usage = total_usage
            
            if transfer and transfer.is_confirmed and (is_old_tenant or is_new_tenant):
                transfer_reading = None
                if meter_type == "water":
                    transfer_reading = transfer.water_reading
                elif meter_type == "electricity":
                    transfer_reading = transfer.electricity_reading
                
                if transfer_reading is not None and transfer_reading > 0:
                    if is_old_tenant:
                        actual_usage = transfer_reading - prev_reading.reading_value
                        split_ratio = actual_usage / total_usage if total_usage > 0 else 0
                    elif is_new_tenant:
                        actual_usage = current_reading.reading_value - transfer_reading
                        split_ratio = actual_usage / total_usage if total_usage > 0 else 0
                else:
                    days_before = calculate_days_between(period_start, transfer.transfer_date)
                    if is_old_tenant:
                        split_ratio = days_before / days_in_period if days_in_period > 0 else 1.0
                    elif is_new_tenant:
                        split_ratio = (days_in_period - days_before) / days_in_period if days_in_period > 0 else 0
                    actual_usage = total_usage * split_ratio
            
            amount = actual_usage * unit_price
            
            bill_item = BillItem(
                bill_id=bill.id,
                meter_type=meter_type,
                reading_id=current_reading.id,
                previous_reading=prev_reading.reading_value,
                current_reading=current_reading.reading_value,
                usage=actual_usage,
                unit_price=unit_price,
                amount=amount,
                days_in_period=days_in_period,
                transfer_split_ratio=split_ratio
            )
            db.add(bill_item)
            total_amount += amount
    bill.total_amount = total_amount
    bill.balance = -total_amount
    db.commit()
    db.refresh(bill)
    return {"bill_id": bill.id, "bill_no": bill_no, "total_amount": total_amount, "status": bill.status}

@app.post("/api/bills/{bill_id}/confirm")
def confirm_bill(request: BillConfirmRequest, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == request.bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    if bill.status == "confirmed":
        return {"message": "已确认", "status": bill.status, "bill_id": bill.id}
    if bill.status == "revoked":
        raise HTTPException(status_code=400, detail="已撤销的账单不能确认")
    total_precharge = db.query(func.sum(Precharge.amount)).filter(Precharge.tenant_id == bill.tenant_id).scalar() or 0
    total_confirmed_bill = db.query(func.sum(Bill.total_amount)).filter(
        Bill.tenant_id == bill.tenant_id,
        Bill.status.in_(["confirmed", "paid"])
    ).scalar() or 0
    balance = total_precharge - total_confirmed_bill
    if balance < bill.total_amount:
        raise HTTPException(status_code=400, detail=f"预充值余额不足，当前余额{balance}元，账单金额{bill.total_amount}元")
    history = BillHistory(
        bill_id=bill.id,
        action="confirm",
        old_status=bill.status,
        new_status="confirmed",
        old_amount=bill.total_amount,
        new_amount=bill.total_amount,
        notes=request.notes
    )
    db.add(history)
    bill.status = "confirmed"
    bill.confirmed_at = datetime.utcnow()
    bill.notes = request.notes
    db.commit()
    return {"message": "确认成功", "status": bill.status, "bill_id": bill.id}

@app.post("/api/bills/{bill_id}/revoke")
def revoke_bill(bill_id: int, notes: Optional[str] = None, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    if bill.status == "revoked":
        return {"message": "已撤销", "status": bill.status}
    if bill.status == "paid":
        raise HTTPException(status_code=400, detail="已付款的账单不能撤销")
    history = BillHistory(
        bill_id=bill.id,
        action="revoke",
        old_status=bill.status,
        new_status="revoked",
        old_amount=bill.total_amount,
        new_amount=bill.total_amount,
        notes=notes
    )
    db.add(history)
    bill.status = "revoked"
    db.commit()
    return {"message": "撤销成功", "status": bill.status}

@app.get("/api/bills/{bill_id}", response_model=BillDetailResponse)
def get_bill_detail(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    items = db.query(BillItem).filter(BillItem.bill_id == bill_id).all()
    return {"bill": bill, "items": items}

@app.get("/api/bills", response_model=List[BillResponse])
def list_bills(
    room_id: Optional[int] = None,
    tenant_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Bill)
    if room_id:
        query = query.filter(Bill.room_id == room_id)
    if tenant_id:
        query = query.filter(Bill.tenant_id == tenant_id)
    if status:
        query = query.filter(Bill.status == status)
    return query.order_by(Bill.created_at.desc()).all()

@app.get("/api/bills/{bill_id}/history")
def get_bill_history(bill_id: int, db: Session = Depends(get_db)):
    history = db.query(BillHistory).filter(BillHistory.bill_id == bill_id).order_by(BillHistory.created_at).all()
    return history

@app.post("/api/bills/{bill_id}/regenerate")
def regenerate_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="账单不存在")
    if bill.status == "paid":
        raise HTTPException(status_code=400, detail="已付款的账单不能重新生成")
    if bill.status == "confirmed":
        history = BillHistory(
            bill_id=bill.id,
            action="regenerate",
            old_status=bill.status,
            new_status="pending",
            old_amount=bill.total_amount,
            new_amount=0
        )
        db.add(history)
    bill.status = "pending"
    bill.total_amount = 0
    db.query(BillItem).filter(BillItem.bill_id == bill_id).delete()
    total_amount = 0
    transfer = db.query(TenantTransfer).filter(TenantTransfer.id == bill.transfer_id).first() if bill.transfer_id else None
    
    is_old_tenant = False
    is_new_tenant = False
    if transfer and transfer.is_confirmed:
        is_old_tenant = (bill.tenant_id == transfer.old_tenant_id)
        is_new_tenant = (bill.tenant_id == transfer.new_tenant_id)
    
    for meter_type in [MeterType.WATER, MeterType.ELECTRICITY]:
        readings = db.query(MeterReading).filter(
            MeterReading.room_id == bill.room_id,
            MeterReading.meter_type == meter_type,
            MeterReading.reading_date >= bill.period_start,
            MeterReading.reading_date <= bill.period_end,
            MeterReading.status == "confirmed"
        ).order_by(MeterReading.reading_date).all()
        if not readings:
            continue
        prev_reading = get_previous_reading(db, bill.room_id, meter_type, bill.period_start)
        if not prev_reading and readings:
            prev_reading = readings[0]
        if prev_reading:
            current_reading = readings[-1]
            total_usage = current_reading.reading_value - prev_reading.reading_value
            unit_price = get_price_at_date(db, meter_type, bill.period_end)
            days_in_period = calculate_days_between(bill.period_start, bill.period_end)
            
            split_ratio = 1.0
            actual_usage = total_usage
            
            if transfer and transfer.is_confirmed and (is_old_tenant or is_new_tenant):
                transfer_reading = None
                if meter_type == "water":
                    transfer_reading = transfer.water_reading
                elif meter_type == "electricity":
                    transfer_reading = transfer.electricity_reading
                
                if transfer_reading is not None and transfer_reading > 0:
                    if is_old_tenant:
                        actual_usage = transfer_reading - prev_reading.reading_value
                        split_ratio = actual_usage / total_usage if total_usage > 0 else 0
                    elif is_new_tenant:
                        actual_usage = current_reading.reading_value - transfer_reading
                        split_ratio = actual_usage / total_usage if total_usage > 0 else 0
                else:
                    days_before = calculate_days_between(bill.period_start, transfer.transfer_date)
                    if is_old_tenant:
                        split_ratio = days_before / days_in_period if days_in_period > 0 else 1.0
                    elif is_new_tenant:
                        split_ratio = (days_in_period - days_before) / days_in_period if days_in_period > 0 else 0
                    actual_usage = total_usage * split_ratio
            
            amount = actual_usage * unit_price
            
            bill_item = BillItem(
                bill_id=bill.id,
                meter_type=meter_type,
                reading_id=current_reading.id,
                previous_reading=prev_reading.reading_value,
                current_reading=current_reading.reading_value,
                usage=actual_usage,
                unit_price=unit_price,
                amount=amount,
                days_in_period=days_in_period,
                transfer_split_ratio=split_ratio
            )
            db.add(bill_item)
            total_amount += amount
    bill.total_amount = total_amount
    bill.balance = -total_amount
    db.commit()
    db.refresh(bill)
    return {"bill_id": bill.id, "bill_no": bill.bill_no, "total_amount": total_amount, "status": bill.status}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
