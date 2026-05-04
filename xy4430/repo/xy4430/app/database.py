from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./dive_station.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(50), unique=True, index=True, nullable=False)
    compressor_id = Column(String(50), nullable=False)
    fill_date = Column(DateTime, nullable=False)
    operator_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    cylinders = relationship("Cylinder", back_populates="batch")
    risks = relationship("Risk", back_populates="batch")


class Cylinder(Base):
    __tablename__ = "cylinders"
    
    id = Column(Integer, primary_key=True, index=True)
    serial_number = Column(String(100), unique=True, index=True, nullable=False)
    cylinder_type = Column(String(50))
    capacity_liters = Column(Float)
    working_pressure_bar = Column(Integer)
    test_expiry_date = Column(DateTime, nullable=False)
    last_test_date = Column(DateTime)
    owner_name = Column(String(100))
    owner_contact = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    fill_records = relationship("FillRecord", back_populates="cylinder")
    appointments = relationship("Appointment", back_populates="cylinder")
    risks = relationship("Risk", back_populates="cylinder")
    reviews = relationship("ReviewRecord", back_populates="cylinder")
    batch_id = Column(Integer, ForeignKey("batches.id"))
    batch = relationship("Batch", back_populates="cylinders")


class FillRecord(Base):
    __tablename__ = "fill_records"
    
    id = Column(Integer, primary_key=True, index=True)
    cylinder_id = Column(Integer, ForeignKey("cylinders.id"), nullable=False)
    fill_date = Column(DateTime, nullable=False)
    fill_pressure_bar = Column(Integer, nullable=False)
    target_pressure_bar = Column(Integer)
    compressor_id = Column(String(50))
    operator_name = Column(String(100))
    cooling_start_time = Column(DateTime)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    
    cylinder = relationship("Cylinder", back_populates="fill_records")


class CompressorMaintenance(Base):
    __tablename__ = "compressor_maintenance"
    
    id = Column(Integer, primary_key=True, index=True)
    compressor_id = Column(String(50), unique=True, index=True, nullable=False)
    model = Column(String(100))
    last_maintenance_date = Column(DateTime)
    filter_change_date = Column(DateTime)
    filter_expiry_date = Column(DateTime)
    next_service_date = Column(DateTime)
    operating_hours = Column(Float, default=0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    appointment_number = Column(String(50), unique=True, index=True, nullable=False)
    cylinder_id = Column(Integer, ForeignKey("cylinders.id"), nullable=False)
    customer_name = Column(String(100), nullable=False)
    customer_contact = Column(String(100))
    pickup_date = Column(DateTime, nullable=False)
    status = Column(String(20), default="pending")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    cylinder = relationship("Cylinder", back_populates="appointments")
    risks = relationship("Risk", back_populates="appointment")
    reviews = relationship("ReviewRecord", back_populates="appointment")


class Risk(Base):
    __tablename__ = "risks"
    
    id = Column(Integer, primary_key=True, index=True)
    risk_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="medium")
    description = Column(Text, nullable=False)
    cylinder_id = Column(Integer, ForeignKey("cylinders.id"))
    appointment_id = Column(Integer, ForeignKey("appointments.id"))
    batch_id = Column(Integer, ForeignKey("batches.id"))
    compressor_id = Column(String(50))
    detected_at = Column(DateTime, default=datetime.utcnow)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    resolved_by = Column(String(100))
    resolution_notes = Column(Text)
    
    cylinder = relationship("Cylinder", back_populates="risks")
    appointment = relationship("Appointment", back_populates="risks")
    batch = relationship("Batch", back_populates="risks")


class ReviewRecord(Base):
    __tablename__ = "review_records"
    
    id = Column(Integer, primary_key=True, index=True)
    review_number = Column(String(50), unique=True, index=True, nullable=False)
    cylinder_id = Column(Integer, ForeignKey("cylinders.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"))
    reviewer_name = Column(String(100), nullable=False)
    review_date = Column(DateTime, default=datetime.utcnow)
    review_type = Column(String(20), nullable=False)
    status = Column(String(20), default="pending")
    notes = Column(Text)
    rescheduled_to = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    cylinder = relationship("Cylinder", back_populates="reviews")
    appointment = relationship("Appointment", back_populates="reviews")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
