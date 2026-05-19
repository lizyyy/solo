from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, ForeignKey, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from config import settings
import re

engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def mask_sensitive_data(data: dict) -> dict:
    if not data:
        return data
    result = data.copy() if isinstance(data, dict) else data
    for field, config in settings.SENSITIVE_FIELDS.items():
        if field in result and config["mask"] and result[field]:
            result[field] = re.sub(config["pattern"], config["replace"], str(result[field]))
    return result

class Bus(Base):
    __tablename__ = "buses"
    id = Column(Integer, primary_key=True, index=True)
    bus_number = Column(String(50), unique=True, index=True, nullable=False)
    plate_number = Column(String(50))
    route_name = Column(String(100))
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

class Driver(Base):
    __tablename__ = "drivers"
    id = Column(Integer, primary_key=True, index=True)
    driver_name = Column(String(100), nullable=False)
    driver_phone = Column(String(20), unique=True, index=True)
    employee_id = Column(String(50), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    def to_dict_masked(self):
        return mask_sensitive_data({
            "id": self.id,
            "driver_name": self.driver_name,
            "driver_phone": self.driver_phone,
            "employee_id": self.employee_id,
            "is_active": self.is_active
        })

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String(100), nullable=False)
    student_number = Column(String(50), unique=True, index=True)
    parent_name = Column(String(100))
    parent_phone = Column(String(20), index=True)
    bus_route = Column(String(100))
    stop_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    def to_dict_masked(self):
        return mask_sensitive_data({
            "id": self.id,
            "student_name": self.student_name,
            "student_number": self.student_number,
            "parent_name": self.parent_name,
            "parent_phone": self.parent_phone,
            "bus_route": self.bus_route,
            "stop_name": self.stop_name
        })

class DriverCheckin(Base):
    __tablename__ = "driver_checkins"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String(100), unique=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False)
    bus_id = Column(Integer, ForeignKey("buses.id"))
    checkin_time = Column(DateTime, nullable=False, index=True)
    checkin_type = Column(String(20), default="start")
    location_lat = Column(Float)
    location_lng = Column(Float)
    location_name = Column(String(200))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    imported_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_driver_checkin_time", "driver_id", "checkin_time"),
    )

class GpsTrack(Base):
    __tablename__ = "gps_tracks"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String(100), unique=True, index=True)
    bus_id = Column(Integer, ForeignKey("buses.id"), nullable=False)
    record_time = Column(DateTime, nullable=False, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    speed = Column(Float)
    heading = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    imported_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_bus_gps_time", "bus_id", "record_time"),
    )

class ParentComplaint(Base):
    __tablename__ = "parent_complaints"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String(100), unique=True, index=True)
    complaint_number = Column(String(50), unique=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    student_name = Column(String(100))
    parent_name = Column(String(100))
    parent_phone = Column(String(20))
    bus_route = Column(String(100))
    stop_name = Column(String(100))
    complaint_date = Column(DateTime, nullable=False, index=True)
    scheduled_arrival = Column(DateTime)
    actual_arrival = Column(DateTime)
    complaint_type = Column(String(50))
    description = Column(Text)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    imported_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_complaint_date_route", "complaint_date", "bus_route"),
    )
    
    def to_dict_masked(self):
        return mask_sensitive_data({
            "id": self.id,
            "complaint_number": self.complaint_number,
            "student_name": self.student_name,
            "parent_name": self.parent_name,
            "parent_phone": self.parent_phone,
            "bus_route": self.bus_route,
            "stop_name": self.stop_name,
            "complaint_date": self.complaint_date.isoformat() if self.complaint_date else None,
            "status": self.status
        })

class Ruling(Base):
    __tablename__ = "rulings"
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("parent_complaints.id"), unique=True, nullable=False)
    ruling_number = Column(String(50), unique=True, index=True)
    status = Column(String(20), default="draft")
    responsibility = Column(String(50))
    delay_minutes = Column(Integer, default=0)
    root_cause = Column(String(200))
    gps_evidence = Column(Text)
    checkin_evidence = Column(Text)
    ruling_reason = Column(Text)
    ruled_at = Column(DateTime)
    ruled_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    complaint = relationship("ParentComplaint", backref="ruling")

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    ruling_id = Column(Integer, ForeignKey("rulings.id"), nullable=False)
    review_number = Column(String(50), unique=True, index=True)
    reviewer = Column(String(100))
    review_result = Column(String(20))
    review_notes = Column(Text)
    original_responsibility = Column(String(50))
    new_responsibility = Column(String(50))
    reviewed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    ruling = relationship("Ruling", backref="reviews")

class BatchOperation(Base):
    __tablename__ = "batch_operations"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True)
    operation_type = Column(String(50), index=True)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    status = Column(String(20), default="processing")
    error_details = Column(Text)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

class BatchOperationItem(Base):
    __tablename__ = "batch_operation_items"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), index=True)
    item_index = Column(Integer)
    item_id = Column(String(100))
    status = Column(String(20), index=True)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
