from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./geofence.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Geofence(Base):
    __tablename__ = "geofences"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    fence_type = Column(String(50), default="polygon")
    coordinates = Column(JSON, nullable=False)
    radius = Column(Float)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    alerts = relationship("AlertEvent", back_populates="geofence")
    devices = relationship("DeviceAssignment", back_populates="geofence")

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(100))
    device_type = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    positions = relationship("DevicePosition", back_populates="device")
    assignments = relationship("DeviceAssignment", back_populates="device")

class DevicePosition(Base):
    __tablename__ = "device_positions"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude = Column(Float)
    speed = Column(Float)
    direction = Column(Float)
    accuracy = Column(Float)
    timestamp = Column(DateTime, nullable=False)
    is_valid = Column(Boolean, default=True)
    source = Column(String(50))

    device = relationship("Device", back_populates="positions")

class DeviceAssignment(Base):
    __tablename__ = "device_assignments"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    geofence_id = Column(Integer, ForeignKey("geofences.id"))
    is_active = Column(Boolean, default=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device", back_populates="assignments")
    geofence = relationship("Geofence", back_populates="devices")

class AlertEvent(Base):
    __tablename__ = "alert_events"

    id = Column(Integer, primary_key=True, index=True)
    geofence_id = Column(Integer, ForeignKey("geofences.id"))
    device_id = Column(Integer, ForeignKey("devices.id"))
    event_type = Column(String(20), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    position_id = Column(Integer, ForeignKey("device_positions.id"))
    is_false_alarm = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    verified_by = Column(String(50))
    verified_at = Column(DateTime)
    notes = Column(Text)
    confidence = Column(Float, default=1.0)

    geofence = relationship("Geofence", back_populates="alerts")
    device = relationship("Device")
    position = relationship("DevicePosition")

class NotificationStrategy(Base):
    __tablename__ = "notification_strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    geofence_id = Column(Integer, ForeignKey("geofences.id"))
    event_types = Column(JSON)
    channels = Column(JSON)
    min_interval = Column(Integer, default=60)
    confidence_threshold = Column(Float, default=0.8)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class FalseAlarmFilter(Base):
    __tablename__ = "false_alarm_filters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    filter_type = Column(String(50))
    parameters = Column(JSON)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class TrajectoryReport(Base):
    __tablename__ = "trajectory_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(50), unique=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    geofence_id = Column(Integer, ForeignKey("geofences.id"))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    total_points = Column(Integer)
    enter_count = Column(Integer)
    exit_count = Column(Integer)
    stay_duration = Column(Float)
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String(50))
    status = Column(String(20), default="completed")

    device = relationship("Device")
    geofence = relationship("Geofence")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)