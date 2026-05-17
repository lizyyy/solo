from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./car_wash.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True)
    member_number = Column(String, index=True)
    membership_level = Column(String, default="普通")
    balance = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    station_type = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    current_queue_id = Column(Integer, nullable=True)
    status = Column(String, default="空闲")
    created_at = Column(DateTime, default=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    appointment_time = Column(DateTime, nullable=False)
    service_type = Column(String, nullable=False)
    status = Column(String, default="待确认")
    booked_station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    queue_number_id = Column(Integer, nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QueueNumber(Base):
    __tablename__ = "queue_numbers"

    id = Column(Integer, primary_key=True, index=True)
    queue_date = Column(String, index=True, nullable=False)
    sequence_number = Column(Integer, nullable=False)
    display_number = Column(String, index=True, nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    service_type = Column(String, nullable=False)
    status = Column(String, default="等待中")
    priority = Column(Integer, default=0)
    assigned_station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    called_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    is_appointment = Column(Boolean, default=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    member = relationship("Member")


class PassedRecord(Base):
    __tablename__ = "passed_records"

    id = Column(Integer, primary_key=True, index=True)
    queue_number_id = Column(Integer, ForeignKey("queue_numbers.id"), nullable=False)
    passed_at = Column(DateTime, default=datetime.utcnow)
    requeued_at = Column(DateTime, nullable=True)
    new_queue_number_id = Column(Integer, ForeignKey("queue_numbers.id"), nullable=True)
    reason = Column(String)
    notes = Column(Text)
    operator = Column(String)

    queue_number = relationship("QueueNumber", foreign_keys=[queue_number_id])


class QueueReport(Base):
    __tablename__ = "queue_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(String, unique=True, index=True, nullable=False)
    total_queues = Column(Integer, default=0)
    total_completed = Column(Integer, default=0)
    total_passed = Column(Integer, default=0)
    avg_wait_time = Column(Float, default=0.0)
    avg_service_time = Column(Float, default=0.0)
    peak_hour = Column(String)
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
