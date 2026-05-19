from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum
from datetime import datetime

Base = declarative_base()

class WorkOrderStatus(str, enum.Enum):
    DRAFT = "draft"
    IMPORTED = "imported"
    VALIDATING = "validating"
    VALID = "valid"
    INVALID = "invalid"
    BILLED = "billed"
    REVIEWED = "reviewed"

class BillingType(str, enum.Enum):
    BY_HOUR = "by_hour"
    BY_AREA = "by_area"
    MIXED = "mixed"

class Operator(Base):
    __tablename__ = "operators"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    id_card = Column(String(50))
    hourly_rate = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True)
    
    work_orders = relationship("WorkOrder", back_populates="operator")

class Tractor(Base):
    __tablename__ = "tractors"
    
    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String(50), unique=True, nullable=False)
    model = Column(String(100))
    horsepower = Column(Integer)
    hourly_rate = Column(Float, default=0)
    area_rate = Column(Float, default=0)
    fuel_consumption = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True)
    
    work_orders = relationship("WorkOrder", back_populates="tractor")

class WorkOrder(Base):
    __tablename__ = "work_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, nullable=False)
    operator_id = Column(Integer, ForeignKey("operators.id"))
    tractor_id = Column(Integer, ForeignKey("tractors.id"))
    customer_name = Column(String(100))
    customer_phone = Column(String(50))
    work_type = Column(String(100))
    
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    work_hours = Column(Float, default=0)
    work_area = Column(Float, default=0)
    fuel_used = Column(Float, default=0)
    
    billing_type = Column(Enum(BillingType), default=BillingType.MIXED)
    hourly_rate = Column(Float, default=0)
    area_rate = Column(Float, default=0)
    fuel_price = Column(Float, default=0)
    minimum_charge = Column(Float, default=0)
    
    calculated_amount = Column(Float, default=0)
    final_amount = Column(Float, default=0)
    status = Column(Enum(WorkOrderStatus), default=WorkOrderStatus.DRAFT)
    
    import_batch_id = Column(String(100))
    import_row_number = Column(Integer)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    notes = Column(Text)
    
    operator = relationship("Operator", back_populates="work_orders")
    tractor = relationship("Tractor", back_populates="work_orders")
    validation_logs = relationship("ValidationLog", back_populates="work_order")
    bill_items = relationship("BillItem", back_populates="work_order")

class ValidationLog(Base):
    __tablename__ = "validation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    check_name = Column(String(100), nullable=False)
    passed = Column(Boolean, default=False)
    message = Column(Text)
    severity = Column(String(20), default="error")
    created_at = Column(DateTime, default=datetime.now)
    
    work_order = relationship("WorkOrder", back_populates="validation_logs")

class Bill(Base):
    __tablename__ = "bills"
    
    id = Column(Integer, primary_key=True, index=True)
    bill_no = Column(String(50), unique=True, nullable=False)
    operator_id = Column(Integer, ForeignKey("operators.id"))
    billing_period_start = Column(DateTime)
    billing_period_end = Column(DateTime)
    
    total_hours = Column(Float, default=0)
    total_area = Column(Float, default=0)
    total_fuel = Column(Float, default=0)
    subtotal = Column(Float, default=0)
    deductions = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    
    status = Column(String(20), default="generated")
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    items = relationship("BillItem", back_populates="bill")

class BillItem(Base):
    __tablename__ = "bill_items"
    
    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"))
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    
    work_hours = Column(Float, default=0)
    work_area = Column(Float, default=0)
    fuel_used = Column(Float, default=0)
    hourly_amount = Column(Float, default=0)
    area_amount = Column(Float, default=0)
    fuel_amount = Column(Float, default=0)
    line_total = Column(Float, default=0)
    
    bill = relationship("Bill", back_populates="items")
    work_order = relationship("WorkOrder", back_populates="bill_items")

class ImportBatch(Base):
    __tablename__ = "import_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, nullable=False)
    filename = Column(String(255))
    total_rows = Column(Integer, default=0)
    valid_rows = Column(Integer, default=0)
    invalid_rows = Column(Integer, default=0)
    status = Column(String(20), default="processing")
    created_at = Column(DateTime, default=datetime.now)
    completed_at = Column(DateTime)
