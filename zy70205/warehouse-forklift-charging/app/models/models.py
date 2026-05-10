from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum

class ForkliftStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"
    DECOMMISSIONED = "decommissioned"

class ChargingStationStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    MAINTENANCE = "maintenance"

class ChargingStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    CHARGING = "charging"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"

class TaskPriority(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Forklift(Base):
    __tablename__ = "forklifts"

    id = Column(Integer, primary_key=True, index=True)
    forklift_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    status = Column(Enum(ForkliftStatus), default=ForkliftStatus.ACTIVE, nullable=False)
    battery_capacity = Column(Float, nullable=False, comment="电池容量（kWh）")
    max_battery_percent = Column(Float, default=100.0)
    min_operating_percent = Column(Float, default=20.0, comment="最低运行电量")
    charging_rate = Column(Float, default=10.0, comment="充电速率（kWh/小时）")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)

    battery = relationship("BatteryStatus", back_populates="forklift", uselist=False)
    tasks = relationship("Task", back_populates="forklift")
    charging_requests = relationship("ChargingRequest", back_populates="forklift")

class ChargingStation(Base):
    __tablename__ = "charging_stations"

    id = Column(Integer, primary_key=True, index=True)
    station_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    status = Column(Enum(ChargingStationStatus), default=ChargingStationStatus.AVAILABLE, nullable=False)
    charging_power = Column(Float, default=50.0, comment="充电桩功率（kW）")
    current_forklift_id = Column(Integer, ForeignKey("forklifts.id"), nullable=True)
    lock_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    current_forklift = relationship("Forklift", foreign_keys=[current_forklift_id])

class BatteryStatus(Base):
    __tablename__ = "battery_statuses"

    id = Column(Integer, primary_key=True, index=True)
    forklift_id = Column(Integer, ForeignKey("forklifts.id"), unique=True, nullable=False)
    current_percent = Column(Float, nullable=False, default=100.0)
    last_update_time = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_charging_start = Column(DateTime, nullable=True)
    last_charging_end = Column(DateTime, nullable=True)
    estimated_full_charge_time = Column(DateTime, nullable=True)
    cycle_count = Column(Integer, default=0, comment="充放电循环次数")
    health_percent = Column(Float, default=100.0, comment="电池健康度")

    forklift = relationship("Forklift", back_populates="battery")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_code = Column(String(50), unique=True, index=True, nullable=False)
    forklift_id = Column(Integer, ForeignKey("forklifts.id"), nullable=False)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM, nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    estimated_duration_hours = Column(Float, nullable=False, comment="预计执行时长（小时）")
    required_battery_percent = Column(Float, nullable=False, comment="任务所需电量")
    scheduled_start_time = Column(DateTime, nullable=False)
    scheduled_end_time = Column(DateTime, nullable=False)
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    forklift = relationship("Forklift", back_populates="tasks")

class ChargingRequest(Base):
    __tablename__ = "charging_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_code = Column(String(50), unique=True, index=True, nullable=False)
    forklift_id = Column(Integer, ForeignKey("forklifts.id"), nullable=False)
    station_id = Column(Integer, ForeignKey("charging_stations.id"), nullable=True)
    status = Column(Enum(ChargingStatus), default=ChargingStatus.PENDING, nullable=False)
    target_percent = Column(Float, default=100.0, comment="目标充电百分比")
    start_percent = Column(Float, nullable=False, comment="开始充电时电量")
    end_percent = Column(Float, nullable=True, comment="结束充电时电量")
    queued_at = Column(DateTime, nullable=True)
    charging_started_at = Column(DateTime, nullable=True)
    charging_ended_at = Column(DateTime, nullable=True)
    estimated_completion_time = Column(DateTime, nullable=True)
    queue_position = Column(Integer, nullable=True)
    priority_score = Column(Float, default=0.0, comment="优先级分数（用于排队排序）")
    request_source = Column(String(50), default="auto", comment="请求来源：auto/manual")
    cancel_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    forklift = relationship("Forklift", back_populates="charging_requests")
    station = relationship("ChargingStation")

class ChargingQueue(Base):
    __tablename__ = "charging_queues"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("charging_requests.id"), nullable=False)
    position = Column(Integer, nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

    request = relationship("ChargingRequest")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    operator = Column(String(100), default="system")
    timestamp = Column(DateTime, default=datetime.utcnow)
    description = Column(Text, nullable=True)
