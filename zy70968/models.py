from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    spray_area = Column(String, index=True, nullable=False)
    chemical_id = Column(Integer, ForeignKey("chemicals.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    weather_id = Column(Integer, ForeignKey("weather_records.id"), nullable=False)
    dosage = Column(Float, nullable=False)
    planned_date = Column(DateTime, nullable=False)
    status = Column(String, default="pending", index=True)
    operator = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chemical = relationship("Chemical", back_populates="batches")
    job = relationship("Job", back_populates="batches")
    weather = relationship("WeatherRecord", back_populates="batches")
    audit_logs = relationship("AuditLog", back_populates="batch", cascade="all, delete-orphan")


class Chemical(Base):
    __tablename__ = "chemicals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    manufacturer = Column(String)
    active_ingredient = Column(String)
    concentration = Column(Float)
    max_dosage_per_ha = Column(Float)
    safety_interval_hours = Column(Integer)
    min_wind_speed = Column(Float, default=0.0)
    max_wind_speed = Column(Float, default=10.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    batches = relationship("Batch", back_populates="chemical")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_no = Column(String, unique=True, index=True, nullable=False)
    site_name = Column(String)
    area_ha = Column(Float)
    target_pest = Column(String)
    description = Column(Text)
    csv_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    batches = relationship("Batch", back_populates="job")


class WeatherRecord(Base):
    __tablename__ = "weather_records"

    id = Column(Integer, primary_key=True, index=True)
    record_time = Column(DateTime, index=True, nullable=False)
    location = Column(String, index=True, nullable=False)
    wind_speed = Column(Float)
    wind_direction = Column(String)
    temperature = Column(Float)
    humidity = Column(Float)
    rainfall = Column(Float, default=0.0)
    weather_window_start = Column(DateTime)
    weather_window_end = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    batches = relationship("Batch", back_populates="weather")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    action = Column(String, nullable=False)
    reason = Column(Text)
    handler = Column(String)
    old_status = Column(String)
    new_status = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(Text)

    batch = relationship("Batch", back_populates="audit_logs")
