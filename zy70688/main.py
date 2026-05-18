from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, ForeignKey, Text, or_, and_
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import Optional, List
from enum import Enum
import json
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_drive.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    CONFLICT = "conflict"

class MaintenanceStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class FuelingStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class FuelingType(str, Enum):
    GASOLINE = "gasoline"
    DIESEL = "diesel"
    ELECTRIC = "electric"
    HYBRID = "hybrid"

class VehicleStatus(str, Enum):
    AVAILABLE = "available"
    IN_TEST_DRIVE = "in_test_drive"
    IN_MAINTENANCE = "in_maintenance"
    IN_FUELING = "in_fueling"
    LOCKED = "locked"

class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String, unique=True, index=True)
    model = Column(String)
    brand = Column(String)
    year = Column(Integer)
    status = Column(String, default=VehicleStatus.AVAILABLE)
    current_mileage = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    appointments = relationship("Appointment", back_populates="vehicle")
    maintenances = relationship("Maintenance", back_populates="vehicle")
    fuelings = relationship("Fueling", back_populates="vehicle")
    mileage_records = relationship("MileageRecord", back_populates="vehicle")

class Salesperson(Base):
    __tablename__ = "salespersons"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    phone = Column(String)
    employee_id = Column(String, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    appointments = relationship("Appointment", back_populates="salesperson")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    phone = Column(String)
    license_number = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    appointments = relationship("Appointment", back_populates="customer")

class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    salesperson_id = Column(Integer, ForeignKey("salespersons.id"))
    customer_id = Column(Integer, ForeignKey("customers.id"))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default=AppointmentStatus.PENDING)
    start_mileage = Column(Float, nullable=True)
    end_mileage = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    vehicle = relationship("Vehicle", back_populates="appointments")
    salesperson = relationship("Salesperson", back_populates="appointments")
    customer = relationship("Customer", back_populates="appointments")
    exception_logs = relationship("ExceptionLog", back_populates="appointment")

class Maintenance(Base):
    __tablename__ = "maintenances"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default=MaintenanceStatus.SCHEDULED)
    type = Column(String)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    vehicle = relationship("Vehicle", back_populates="maintenances")

class Fueling(Base):
    __tablename__ = "fuelings"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default=FuelingStatus.SCHEDULED)
    type = Column(String)
    amount = Column(Float, nullable=True)
    cost = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    vehicle = relationship("Vehicle", back_populates="fuelings")

class MileageRecord(Base):
    __tablename__ = "mileage_records"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    mileage = Column(Float)
    record_type = Column(String)
    recorded_at = Column(DateTime, default=datetime.utcnow)
    recorded_by = Column(String)
    notes = Column(Text, nullable=True)
    vehicle = relationship("Vehicle", back_populates="mileage_records")

class ExceptionLog(Base):
    __tablename__ = "exception_logs"
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"))
    original_input = Column(Text)
    handler = Column(String)
    conclusion = Column(Text)
    exception_type = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    appointment = relationship("Appointment", back_populates="exception_logs")

Base.metadata.create_all(bind=engine)

class VehicleCreate(BaseModel):
    plate_number: str
    model: str
    brand: str
    year: int
    current_mileage: Optional[float] = 0.0

class VehicleResponse(BaseModel):
    id: int
    plate_number: str
    model: str
    brand: str
    year: int
    status: str
    current_mileage: float
    class Config:
        from_attributes = True

class SalespersonCreate(BaseModel):
    name: str
    phone: str
    employee_id: str

class SalespersonResponse(BaseModel):
    id: int
    name: str
    phone: str
    employee_id: str
    class Config:
        from_attributes = True

class CustomerCreate(BaseModel):
    name: str
    phone: str
    license_number: str

class CustomerResponse(BaseModel):
    id: int
    name: str
    phone: str
    license_number: str
    class Config:
        from_attributes = True

class AppointmentCreate(BaseModel):
    vehicle_id: int
    salesperson_id: int
    customer_id: int
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None

class AppointmentUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[AppointmentStatus] = None
    start_mileage: Optional[float] = None
    end_mileage: Optional[float] = None
    notes: Optional[str] = None

class ManualCorrection(BaseModel):
    handler: str
    conclusion: str
    new_status: Optional[AppointmentStatus] = None
    new_start_time: Optional[datetime] = None
    new_end_time: Optional[datetime] = None

class AppointmentResponse(BaseModel):
    id: int
    vehicle_id: int
    salesperson_id: int
    customer_id: int
    start_time: datetime
    end_time: datetime
    status: str
    start_mileage: Optional[float]
    end_mileage: Optional[float]
    notes: Optional[str]
    vehicle: Optional[VehicleResponse]
    salesperson: Optional[SalespersonResponse]
    customer: Optional[CustomerResponse]
    class Config:
        from_attributes = True

class MaintenanceCreate(BaseModel):
    vehicle_id: int
    start_time: datetime
    end_time: datetime
    type: str
    notes: Optional[str] = None

class MaintenanceResponse(BaseModel):
    id: int
    vehicle_id: int
    start_time: datetime
    end_time: datetime
    status: str
    type: str
    notes: Optional[str]
    class Config:
        from_attributes = True

class FuelingCreate(BaseModel):
    vehicle_id: int
    start_time: datetime
    end_time: datetime
    type: str
    amount: Optional[float] = None
    cost: Optional[float] = None
    notes: Optional[str] = None

class FuelingResponse(BaseModel):
    id: int
    vehicle_id: int
    start_time: datetime
    end_time: datetime
    status: str
    type: str
    amount: Optional[float]
    cost: Optional[float]
    notes: Optional[str]
    class Config:
        from_attributes = True

class MileageRecordResponse(BaseModel):
    id: int
    vehicle_id: int
    appointment_id: Optional[int]
    mileage: float
    record_type: str
    recorded_at: datetime
    recorded_by: str
    class Config:
        from_attributes = True

app = FastAPI(title="试驾排期保养冲突里程归档API")

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

def check_time_overlap(start1: datetime, end1: datetime, start2: datetime, end2: datetime) -> bool:
    return start1 < end2 and start2 < end1

def check_conflicts(db: Session, vehicle_id: int, salesperson_id: int, start_time: datetime, end_time: datetime, exclude_appointment_id: Optional[int] = None) -> List[str]:
    conflicts = []
    query = db.query(Appointment).filter(
        Appointment.vehicle_id == vehicle_id,
        Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS])
    )
    if exclude_appointment_id:
        query = query.filter(Appointment.id != exclude_appointment_id)
    appointments = query.all()
    for apt in appointments:
        if check_time_overlap(start_time, end_time, apt.start_time, apt.end_time):
            conflicts.append(f"与预约 #{apt.id} 车辆时间冲突")
    sp_query = db.query(Appointment).filter(
        Appointment.salesperson_id == salesperson_id,
        Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS])
    )
    if exclude_appointment_id:
        sp_query = sp_query.filter(Appointment.id != exclude_appointment_id)
    sp_appointments = sp_query.all()
    for apt in sp_appointments:
        if check_time_overlap(start_time, end_time, apt.start_time, apt.end_time):
            conflicts.append(f"与预约 #{apt.id} 销售时间冲突")
    maintenances = db.query(Maintenance).filter(
        Maintenance.vehicle_id == vehicle_id,
        Maintenance.status.in_([MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS])
    ).all()
    for mnt in maintenances:
        if check_time_overlap(start_time, end_time, mnt.start_time, mnt.end_time):
            conflicts.append(f"与保养时段冲突 ({mnt.type})")
    fuelings = db.query(Fueling).filter(
        Fueling.vehicle_id == vehicle_id,
        Fueling.status.in_([FuelingStatus.SCHEDULED, FuelingStatus.IN_PROGRESS])
    ).all()
    for fug in fuelings:
        if check_time_overlap(start_time, end_time, fug.start_time, fug.end_time):
            conflicts.append(f"与加油/补能时段冲突 ({fug.type})")
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if vehicle and vehicle.status == VehicleStatus.LOCKED:
        conflicts.append("车辆已锁定")
    return conflicts

@app.post("/vehicles/", response_model=VehicleResponse)
def create_vehicle(vehicle: VehicleCreate, db: Session = Depends(get_db)):
    db_vehicle = Vehicle(**vehicle.model_dump())
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

@app.get("/vehicles/", response_model=List[VehicleResponse])
def list_vehicles(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Vehicle)
    if status:
        query = query.filter(Vehicle.status == status)
    return query.all()

@app.post("/salespersons/", response_model=SalespersonResponse)
def create_salesperson(salesperson: SalespersonCreate, db: Session = Depends(get_db)):
    db_sp = Salesperson(**salesperson.model_dump())
    db.add(db_sp)
    db.commit()
    db.refresh(db_sp)
    return db_sp

@app.get("/salespersons/", response_model=List[SalespersonResponse])
def list_salespersons(db: Session = Depends(get_db)):
    return db.query(Salesperson).all()

@app.post("/customers/", response_model=CustomerResponse)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    db_customer = Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.get("/customers/", response_model=List[CustomerResponse])
def list_customers(db: Session = Depends(get_db)):
    return db.query(Customer).all()

@app.post("/appointments/", response_model=AppointmentResponse)
def create_appointment(appointment: AppointmentCreate, db: Session = Depends(get_db)):
    conflicts = check_conflicts(db, appointment.vehicle_id, appointment.salesperson_id, appointment.start_time, appointment.end_time)
    if conflicts:
        db_appointment = Appointment(**appointment.model_dump(), status=AppointmentStatus.CONFLICT)
        db.add(db_appointment)
        db.commit()
        db.refresh(db_appointment)
        exception_log = ExceptionLog(
            appointment_id=db_appointment.id,
            original_input=json.dumps(appointment.model_dump(), default=str),
            handler="system",
            conclusion=f"创建失败: {', '.join(conflicts)}",
            exception_type="conflict_detection"
        )
        db.add(exception_log)
        db.commit()
        raise HTTPException(status_code=409, detail={"message": "存在冲突", "conflicts": conflicts, "appointment_id": db_appointment.id})
    db_appointment = Appointment(**appointment.model_dump(), status=AppointmentStatus.CONFIRMED)
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment

@app.get("/appointments/", response_model=List[AppointmentResponse])
def list_appointments(
    vehicle_id: Optional[int] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Appointment)
    if vehicle_id:
        query = query.filter(Appointment.vehicle_id == vehicle_id)
    if status:
        query = query.filter(Appointment.status == status)
    if start_date:
        query = query.filter(Appointment.start_time >= start_date)
    if end_date:
        query = query.filter(Appointment.end_time <= end_date)
    return query.order_by(Appointment.start_time).all()

@app.patch("/appointments/{appointment_id}/status")
def update_appointment_status(
    appointment_id: int,
    status: AppointmentStatus,
    db: Session = Depends(get_db)
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    if status == AppointmentStatus.IN_PROGRESS:
        vehicle = db.query(Vehicle).filter(Vehicle.id == appointment.vehicle_id).first()
        vehicle.status = VehicleStatus.IN_TEST_DRIVE
    elif status in [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED]:
        vehicle = db.query(Vehicle).filter(Vehicle.id == appointment.vehicle_id).first()
        vehicle.status = VehicleStatus.AVAILABLE
    appointment.status = status
    db.commit()
    return {"message": "状态更新成功", "appointment_id": appointment_id, "status": status}

@app.post("/appointments/{appointment_id}/correct")
def manual_correction(
    appointment_id: int,
    correction: ManualCorrection,
    db: Session = Depends(get_db)
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    original_data = {
        "start_time": appointment.start_time.isoformat(),
        "end_time": appointment.end_time.isoformat(),
        "status": appointment.status
    }
    if correction.new_start_time and correction.new_end_time:
        conflicts = check_conflicts(
            db, appointment.vehicle_id, appointment.salesperson_id,
            correction.new_start_time, correction.new_end_time,
            appointment_id
        )
        if conflicts:
            raise HTTPException(status_code=409, detail={"message": "修正后仍存在冲突", "conflicts": conflicts})
        appointment.start_time = correction.new_start_time
        appointment.end_time = correction.new_end_time
    if correction.new_status:
        appointment.status = correction.new_status
    exception_log = ExceptionLog(
        appointment_id=appointment_id,
        original_input=json.dumps(original_data),
        handler=correction.handler,
        conclusion=correction.conclusion,
        exception_type="manual_correction"
    )
    db.add(exception_log)
    db.commit()
    return {"message": "人工修正成功", "appointment_id": appointment_id}

@app.post("/appointments/{appointment_id}/cancel")
def cancel_appointment(
    appointment_id: int,
    handler: str,
    db: Session = Depends(get_db)
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    original_status = appointment.status
    appointment.status = AppointmentStatus.CANCELLED
    vehicle = db.query(Vehicle).filter(Vehicle.id == appointment.vehicle_id).first()
    vehicle.status = VehicleStatus.AVAILABLE
    exception_log = ExceptionLog(
        appointment_id=appointment_id,
        original_input=json.dumps({"original_status": original_status}),
        handler=handler,
        conclusion="取消预约，释放车辆",
        exception_type="cancellation"
    )
    db.add(exception_log)
    db.commit()
    return {"message": "取消成功", "appointment_id": appointment_id}

@app.post("/appointments/{appointment_id}/archive-mileage")
def archive_mileage(
    appointment_id: int,
    end_mileage: float,
    recorded_by: str,
    db: Session = Depends(get_db)
):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    if appointment.status != AppointmentStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="试驾未开始")
    vehicle = db.query(Vehicle).filter(Vehicle.id == appointment.vehicle_id).first()
    appointment.end_mileage = end_mileage
    mileage_record = MileageRecord(
        vehicle_id=appointment.vehicle_id,
        appointment_id=appointment_id,
        mileage=end_mileage,
        record_type="test_drive_end",
        recorded_by=recorded_by
    )
    db.add(mileage_record)
    vehicle.current_mileage = end_mileage
    appointment.status = AppointmentStatus.COMPLETED
    vehicle.status = VehicleStatus.AVAILABLE
    db.commit()
    return {"message": "里程归档成功", "appointment_id": appointment_id, "mileage": end_mileage}

@app.post("/maintenances/", response_model=MaintenanceResponse)
def create_maintenance(maintenance: MaintenanceCreate, db: Session = Depends(get_db)):
    appointments = db.query(Appointment).filter(
        Appointment.vehicle_id == maintenance.vehicle_id,
        Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS])
    ).all()
    conflicts = []
    for apt in appointments:
        if check_time_overlap(maintenance.start_time, maintenance.end_time, apt.start_time, apt.end_time):
            conflicts.append(f"与预约 #{apt.id} 冲突")
    fuelings = db.query(Fueling).filter(
        Fueling.vehicle_id == maintenance.vehicle_id,
        Fueling.status.in_([FuelingStatus.SCHEDULED, FuelingStatus.IN_PROGRESS])
    ).all()
    for fug in fuelings:
        if check_time_overlap(maintenance.start_time, maintenance.end_time, fug.start_time, fug.end_time):
            conflicts.append(f"与加油/补能时段冲突 ({fug.type})")
    if conflicts:
        raise HTTPException(status_code=409, detail={"message": "保养时段存在冲突", "conflicts": conflicts})
    db_maintenance = Maintenance(**maintenance.model_dump())
    db.add(db_maintenance)
    db.commit()
    db.refresh(db_maintenance)
    return db_maintenance

@app.get("/maintenances/", response_model=List[MaintenanceResponse])
def list_maintenances(vehicle_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Maintenance)
    if vehicle_id:
        query = query.filter(Maintenance.vehicle_id == vehicle_id)
    return query.all()

@app.patch("/maintenances/{maintenance_id}/status")
def update_maintenance_status(
    maintenance_id: int,
    status: MaintenanceStatus,
    db: Session = Depends(get_db)
):
    maintenance = db.query(Maintenance).filter(Maintenance.id == maintenance_id).first()
    if not maintenance:
        raise HTTPException(status_code=404, detail="保养不存在")
    maintenance.status = status
    db.commit()
    return {"message": "保养状态更新成功", "maintenance_id": maintenance_id, "status": status}

@app.post("/fuelings/", response_model=FuelingResponse)
def create_fueling(fueling: FuelingCreate, db: Session = Depends(get_db)):
    appointments = db.query(Appointment).filter(
        Appointment.vehicle_id == fueling.vehicle_id,
        Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS])
    ).all()
    conflicts = []
    for apt in appointments:
        if check_time_overlap(fueling.start_time, fueling.end_time, apt.start_time, apt.end_time):
            conflicts.append(f"与预约 #{apt.id} 冲突")
    maintenances = db.query(Maintenance).filter(
        Maintenance.vehicle_id == fueling.vehicle_id,
        Maintenance.status.in_([MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS])
    ).all()
    for mnt in maintenances:
        if check_time_overlap(fueling.start_time, fueling.end_time, mnt.start_time, mnt.end_time):
            conflicts.append(f"与保养时段冲突 ({mnt.type})")
    if conflicts:
        raise HTTPException(status_code=409, detail={"message": "加油/补能时段存在冲突", "conflicts": conflicts})
    db_fueling = Fueling(**fueling.model_dump())
    db.add(db_fueling)
    db.commit()
    db.refresh(db_fueling)
    return db_fueling

@app.get("/fuelings/", response_model=List[FuelingResponse])
def list_fuelings(vehicle_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Fueling)
    if vehicle_id:
        query = query.filter(Fueling.vehicle_id == vehicle_id)
    return query.all()

@app.patch("/fuelings/{fueling_id}/status")
def update_fueling_status(
    fueling_id: int,
    status: FuelingStatus,
    db: Session = Depends(get_db)
):
    fueling = db.query(Fueling).filter(Fueling.id == fueling_id).first()
    if not fueling:
        raise HTTPException(status_code=404, detail="加油/补能不存在")
    fueling.status = status
    db.commit()
    return {"message": "加油/补能状态更新成功", "fueling_id": fueling_id, "status": status}

@app.post("/vehicles/{vehicle_id}/lock")
def lock_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    vehicle.status = VehicleStatus.LOCKED
    db.commit()
    return {"message": "车辆已锁定", "vehicle_id": vehicle_id}

@app.post("/vehicles/{vehicle_id}/unlock")
def unlock_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="车辆不存在")
    vehicle.status = VehicleStatus.AVAILABLE
    db.commit()
    return {"message": "车辆已解锁", "vehicle_id": vehicle_id}

@app.get("/mileage-records/", response_model=List[MileageRecordResponse])
def list_mileage_records(vehicle_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(MileageRecord)
    if vehicle_id:
        query = query.filter(MileageRecord.vehicle_id == vehicle_id)
    return query.order_by(MileageRecord.recorded_at.desc()).all()

@app.get("/reports/export")
def export_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    format: str = Query("csv", enum=["csv", "json"]),
    db: Session = Depends(get_db)
):
    query = db.query(Appointment)
    if start_date:
        query = query.filter(Appointment.start_time >= start_date)
    if end_date:
        query = query.filter(Appointment.end_time <= end_date)
    appointments = query.all()
    if format == "json":
        result = []
        for apt in appointments:
            result.append({
                "id": apt.id,
                "vehicle": apt.vehicle.plate_number if apt.vehicle else None,
                "salesperson": apt.salesperson.name if apt.salesperson else None,
                "customer": apt.customer.name if apt.customer else None,
                "start_time": apt.start_time.isoformat(),
                "end_time": apt.end_time.isoformat(),
                "status": apt.status,
                "start_mileage": apt.start_mileage,
                "end_mileage": apt.end_mileage,
                "mileage_diff": apt.end_mileage - apt.start_mileage if apt.end_mileage and apt.start_mileage else None
            })
        return result
    else:
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["预约ID", "车牌号", "销售", "客户", "开始时间", "结束时间", "状态", "开始里程", "结束里程", "里程差"])
        for apt in appointments:
            mileage_diff = apt.end_mileage - apt.start_mileage if apt.end_mileage and apt.start_mileage else None
            writer.writerow([
                apt.id,
                apt.vehicle.plate_number if apt.vehicle else "",
                apt.salesperson.name if apt.salesperson else "",
                apt.customer.name if apt.customer else "",
                apt.start_time.strftime("%Y-%m-%d %H:%M"),
                apt.end_time.strftime("%Y-%m-%d %H:%M"),
                apt.status,
                apt.start_mileage or "",
                apt.end_mileage or "",
                mileage_diff or ""
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=schedule_report.csv"}
        )

@app.get("/exception-logs/")
def list_exception_logs(appointment_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(ExceptionLog)
    if appointment_id:
        query = query.filter(ExceptionLog.appointment_id == appointment_id)
    return query.all()

@app.post("/seed-data")
def seed_data(db: Session = Depends(get_db)):
    vehicles = [
        Vehicle(plate_number="京A12345", model="Model 3", brand="Tesla", year=2023, current_mileage=5000.0),
        Vehicle(plate_number="京B67890", model="汉EV", brand="比亚迪", year=2024, current_mileage=3000.0),
    ]
    db.add_all(vehicles)
    salespersons = [
        Salesperson(name="张三", phone="13800138001", employee_id="SP001"),
        Salesperson(name="李四", phone="13800138002", employee_id="SP002"),
    ]
    db.add_all(salespersons)
    customers = [
        Customer(name="王客户", phone="13900139001", license_number="C12345678"),
        Customer(name="刘客户", phone="13900139002", license_number="C87654321"),
    ]
    db.add_all(customers)
    db.commit()
    return {"message": "造数完成", "vehicles": 2, "salespersons": 2, "customers": 2}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
