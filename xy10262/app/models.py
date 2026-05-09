from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy import ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.constants import QueueStatus, InspectionPriority, RiskLevel


class VehicleQueue(Base):
    __tablename__ = "vehicle_queue"

    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String(20), unique=True, index=True, nullable=False)
    queue_number = Column(Integer, unique=True, index=True, nullable=False)
    cargo_type = Column(String(50), nullable=False)
    risk_level = Column(String(20), default=RiskLevel.LOW.value)
    status = Column(String(20), default=QueueStatus.WAITING.value)
    inspection_priority = Column(String(20), default=InspectionPriority.NORMAL.value)
    target_temp_low = Column(Float, nullable=False)
    target_temp_high = Column(Float, nullable=False)
    entry_time = Column(DateTime, default=datetime.utcnow)
    exit_time = Column(DateTime, nullable=True)
    remark = Column(Text, nullable=True)

    temperature_records = relationship(
        "TemperatureRecord",
        back_populates="vehicle",
        cascade="all, delete-orphan"
    )
    inspection_records = relationship(
        "InspectionRecord",
        back_populates="vehicle",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_queue_status_priority", "status", "inspection_priority"),
    )


class TemperatureRecord(Base):
    __tablename__ = "temperature_records"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicle_queue.id"), nullable=False)
    temperature = Column(Float, nullable=False)
    record_time = Column(DateTime, nullable=False)
    is_normal = Column(Boolean, default=True)
    anomaly_type = Column(String(50), nullable=True)
    is_manual_modified = Column(Boolean, default=False)
    modified_by = Column(String(50), nullable=True)
    original_temperature = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    remark = Column(Text, nullable=True)

    vehicle = relationship("VehicleQueue", back_populates="temperature_records")

    __table_args__ = (
        Index("idx_vehicle_time", "vehicle_id", "record_time"),
    )


class InspectionRecord(Base):
    __tablename__ = "inspection_records"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicle_queue.id"), nullable=False)
    inspector = Column(String(50), nullable=True)
    inspection_result = Column(String(20), nullable=True)
    check_points = Column(Text, nullable=True)
    issues_found = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vehicle = relationship("VehicleQueue", back_populates="inspection_records")
