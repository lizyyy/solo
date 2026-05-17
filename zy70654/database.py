from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./fresh_temperature.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    contact = Column(String)
    phone = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    arrival_orders = relationship("ArrivalOrder", back_populates="supplier")
    inspection_reports = relationship("InspectionReport", back_populates="supplier")

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    thresholds = relationship("RejectionThreshold", back_populates="category")
    arrival_orders = relationship("ArrivalOrder", back_populates="category")

class RejectionThreshold(Base):
    __tablename__ = "rejection_thresholds"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    min_temperature = Column(Float, nullable=False)
    max_temperature = Column(Float, nullable=False)
    sample_size = Column(Integer, default=5)
    reject_count_threshold = Column(Integer, default=2)
    effective_date = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    category = relationship("Category", back_populates="thresholds")

class ArrivalOrder(Base):
    __tablename__ = "arrival_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    arrival_date = Column(DateTime, nullable=False)
    batch_no = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, default="kg")
    vehicle_no = Column(String)
    driver_name = Column(String)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    supplier = relationship("Supplier", back_populates="arrival_orders")
    category = relationship("Category", back_populates="arrival_orders")
    temperature_records = relationship("TemperatureRecord", back_populates="arrival_order")
    inspection_report = relationship("InspectionReport", back_populates="arrival_order", uselist=False)

class TemperatureRecord(Base):
    __tablename__ = "temperature_records"
    
    id = Column(Integer, primary_key=True, index=True)
    arrival_order_id = Column(Integer, ForeignKey("arrival_orders.id"), nullable=False)
    record_no = Column(String, nullable=False)
    measure_time = Column(DateTime, nullable=False)
    temperature = Column(Float, nullable=False)
    measure_point = Column(String)
    operator = Column(String)
    is_anomaly = Column(Boolean, default=False)
    is_reviewed = Column(Boolean, default=False)
    review_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    arrival_order = relationship("ArrivalOrder", back_populates="temperature_records")

class InspectionReport(Base):
    __tablename__ = "inspection_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String, unique=True, index=True, nullable=False)
    arrival_order_id = Column(Integer, ForeignKey("arrival_orders.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    inspection_date = Column(DateTime, default=datetime.utcnow)
    total_samples = Column(Integer, nullable=False)
    anomaly_count = Column(Integer, nullable=False)
    threshold_violated = Column(Boolean, default=False)
    result = Column(String, nullable=False)
    conclusion = Column(Text)
    inspector = Column(String)
    reviewed_by = Column(String)
    is_processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    arrival_order = relationship("ArrivalOrder", back_populates="inspection_report")
    supplier = relationship("Supplier", back_populates="inspection_reports")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
