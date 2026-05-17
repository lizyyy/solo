from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./access_control.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    department = Column(String)
    position = Column(String)
    card_number = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DoorArea(Base):
    __tablename__ = "door_areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    building = Column(String)
    floor = Column(String)
    description = Column(String, nullable=True)


class AccessLog(Base):
    __tablename__ = "access_logs"

    id = Column(Integer, primary_key=True, index=True)
    card_number = Column(String, index=True)
    door_area_id = Column(Integer, ForeignKey("door_areas.id"))
    swipe_time = Column(DateTime, index=True)
    access_type = Column(String)
    original_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    door_area = relationship("DoorArea")


class Whitelist(Base):
    __tablename__ = "whitelists"

    id = Column(Integer, primary_key=True, index=True)
    card_number = Column(String, unique=True, index=True)
    employee_id = Column(String, nullable=True)
    reason = Column(String)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class DetectionTask(Base):
    __tablename__ = "detection_tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    time_window_minutes = Column(Integer, default=60)
    status = Column(String, default="pending")
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    total_anomalies = Column(Integer, default=0)


class AnomalyRecord(Base):
    __tablename__ = "anomaly_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("detection_tasks.id"))
    card_number = Column(String, index=True)
    employee_id = Column(String, nullable=True)
    employee_name = Column(String, nullable=True)
    first_log_id = Column(Integer, ForeignKey("access_logs.id"))
    second_log_id = Column(Integer, ForeignKey("access_logs.id"))
    first_door_area = Column(String)
    second_door_area = Column(String)
    first_swipe_time = Column(DateTime)
    second_swipe_time = Column(DateTime)
    time_diff_minutes = Column(Float)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    current_handler = Column(String, nullable=True)
    final_conclusion = Column(String, nullable=True)
    is_confirmed_anomaly = Column(Boolean, nullable=True)
    close_reason = Column(String, nullable=True)
    closed_by = Column(String, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    first_log = relationship("AccessLog", foreign_keys=[first_log_id])
    second_log = relationship("AccessLog", foreign_keys=[second_log_id])
    task = relationship("DetectionTask")


class AnomalyHistory(Base):
    __tablename__ = "anomaly_histories"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("anomaly_records.id"))
    action = Column(String)
    old_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    handler = Column(String)
    remark = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
