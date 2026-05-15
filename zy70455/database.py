from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, Float, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./call_chain_sampling.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class DutyRecord(Base):
    __tablename__ = "duty_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), index=True)
    duty_date = Column(String(20), index=True)
    department = Column(String(100), index=True)
    duty_person = Column(String(100))
    phone = Column(String(50))
    incident_count = Column(Integer, default=0)
    incidents = Column(JSON)
    external_receipt_status = Column(String(50), default="pending")
    external_receipt_time = Column(DateTime, nullable=True)
    raw_input = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SamplingRule(Base):
    __tablename__ = "sampling_rules"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), index=True)
    name = Column(String(200))
    description = Column(Text)
    department = Column(String(100))
    sampling_rate = Column(Float)
    min_incidents = Column(Integer)
    include_departments = Column(JSON)
    exclude_departments = Column(JSON)
    receipt_timeout_hours = Column(Integer, default=48)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100))


class ProcessingBatch(Base):
    __tablename__ = "processing_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True)
    rule_version = Column(String(50))
    rule_snapshot = Column(JSON)
    department = Column(String(100))
    start_date = Column(String(20))
    end_date = Column(String(20))
    total_records = Column(Integer, default=0)
    sampled_count = Column(Integer, default=0)
    status = Column(String(50), default="processing")
    summary = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    created_by = Column(String(100))


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(100), index=True)
    batch_id = Column(String(100), index=True, nullable=True)
    record_id = Column(Integer, nullable=True)
    operator = Column(String(100))
    operation_time = Column(DateTime, default=datetime.utcnow)
    details = Column(JSON)
    status = Column(String(50), default="success")
    error_message = Column(Text, nullable=True)


class CleanupCandidate(Base):
    __tablename__ = "cleanup_candidates"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(String(100), unique=True, index=True)
    operation_type = Column(String(50))
    batch_ids = Column(JSON)
    record_ids = Column(JSON)
    reason = Column(Text)
    summary = Column(JSON)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    executed_by = Column(String(100), nullable=True)
    executed_at = Column(DateTime, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
