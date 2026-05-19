from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./bus_schedule.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class GPSRecord(Base):
    __tablename__ = "gps_records"
    
    id = Column(Integer, primary_key=True, index=True)
    bus_id = Column(String(50), index=True)
    driver_id = Column(String(50), index=True)
    timestamp = Column(DateTime, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    speed = Column(Float)
    location_name = Column(String(200))

class DriverCheckIn(Base):
    __tablename__ = "driver_check_ins"
    
    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(String(50), index=True)
    driver_name = Column(String(100))
    bus_id = Column(String(50), index=True)
    check_in_time = Column(DateTime)
    check_in_type = Column(String(20))
    location = Column(String(200))
    status = Column(String(20), default="success")

class ParentComplaint(Base):
    __tablename__ = "parent_complaints"
    
    id = Column(Integer, primary_key=True, index=True)
    parent_name = Column(String(100))
    parent_phone = Column(String(20))
    student_name = Column(String(100))
    bus_route = Column(String(100))
    complaint_time = Column(DateTime)
    complaint_type = Column(String(50))
    description = Column(Text)
    status = Column(String(20), default="pending")

class ScheduleAnomaly(Base):
    __tablename__ = "schedule_anomalies"
    
    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(String(100), unique=True, index=True)
    bus_id = Column(String(50), index=True)
    driver_id = Column(String(50), index=True)
    driver_name = Column(String(100))
    route_name = Column(String(100))
    scheduled_time = Column(DateTime)
    actual_time = Column(DateTime)
    delay_minutes = Column(Integer)
    anomaly_type = Column(String(50), index=True)
    status = Column(String(20), index=True, default="pending")
    responsible_person = Column(String(100), index=True)
    gps_match = Column(Boolean, default=False)
    checkin_match = Column(Boolean, default=False)
    complaint_count = Column(Integer, default=0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
