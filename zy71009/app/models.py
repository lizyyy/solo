from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MaintenanceWindow(Base):
    __tablename__ = "maintenance_windows"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="pending", index=True)
    line_section = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    is_cross_day = Column(Boolean, default=False)
    work_summary = Column(Text)
    applicant = Column(String)
    applicant_department = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    idempotency_key = Column(String, index=True)
    batch_id = Column(String, index=True)
    final_conclusion = Column(Text)
    closed_at = Column(DateTime)
    source_system = Column(String)
    version = Column(Integer, default=1)

    teams = relationship("ConstructionTeam", back_populates="window", cascade="all, delete-orphan")
    power_plans = relationship("PowerPlan", back_populates="window", cascade="all, delete-orphan")
    train_windows = relationship("TrainWindow", back_populates="window", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="window", cascade="all, delete-orphan")
    conflicts = relationship("ConflictRecord", back_populates="window", cascade="all, delete-orphan")
    processors = relationship("WindowProcessor", back_populates="window", cascade="all, delete-orphan")


class ConstructionTeam(Base):
    __tablename__ = "construction_teams"

    id = Column(Integer, primary_key=True, index=True)
    window_id = Column(Integer, ForeignKey("maintenance_windows.id"), nullable=False)
    team_name = Column(String, nullable=False, index=True)
    team_leader = Column(String)
    worker_count = Column(Integer)
    work_scope = Column(Text)
    equipment = Column(Text)
    is_confirmed = Column(Boolean, default=False)
    confirmed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    window = relationship("MaintenanceWindow", back_populates="teams")


class PowerPlan(Base):
    __tablename__ = "power_plans"

    id = Column(Integer, primary_key=True, index=True)
    window_id = Column(Integer, ForeignKey("maintenance_windows.id"), nullable=False)
    power_section = Column(String, nullable=False)
    power_off_time = Column(DateTime, nullable=False)
    power_on_time = Column(DateTime, nullable=False)
    operation_type = Column(String)
    operator = Column(String)
    is_confirmed = Column(Boolean, default=False)
    confirmed_at = Column(DateTime)
    confirm_note = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    window = relationship("MaintenanceWindow", back_populates="power_plans")


class TrainWindow(Base):
    __tablename__ = "train_windows"

    id = Column(Integer, primary_key=True, index=True)
    window_id = Column(Integer, ForeignKey("maintenance_windows.id"), nullable=False)
    train_number = Column(String, index=True)
    avoid_start = Column(DateTime, nullable=False)
    avoid_end = Column(DateTime, nullable=False)
    direction = Column(String)
    track_number = Column(String)
    is_confirmed = Column(Boolean, default=False)
    confirmed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    window = relationship("MaintenanceWindow", back_populates="train_windows")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    window_id = Column(Integer, ForeignKey("maintenance_windows.id"), nullable=False)
    from_status = Column(String)
    to_status = Column(String, nullable=False)
    processor = Column(String)
    processor_department = Column(String)
    remark = Column(Text)
    change_reason = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    window = relationship("MaintenanceWindow", back_populates="status_history")


class ConflictRecord(Base):
    __tablename__ = "conflict_records"

    id = Column(Integer, primary_key=True, index=True)
    window_id = Column(Integer, ForeignKey("maintenance_windows.id"), nullable=False)
    conflict_type = Column(String, nullable=False)
    conflict_window_id = Column(Integer)
    conflict_description = Column(Text)
    conflict_level = Column(String)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    resolution_note = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    window = relationship("MaintenanceWindow", back_populates="conflicts")


class WindowProcessor(Base):
    __tablename__ = "window_processors"

    id = Column(Integer, primary_key=True, index=True)
    window_id = Column(Integer, ForeignKey("maintenance_windows.id"), nullable=False)
    processor_name = Column(String, nullable=False)
    processor_department = Column(String)
    processor_role = Column(String)
    operation = Column(String)
    operation_time = Column(DateTime, server_default=func.now())
    remark = Column(Text)

    window = relationship("MaintenanceWindow", back_populates="processors")


class Processor(Base):
    __tablename__ = "processors"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    real_name = Column(String, nullable=False)
    department = Column(String)
    role = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
