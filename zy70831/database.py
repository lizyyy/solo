from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Float, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./bed_turnover.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Batch(Base):
    __tablename__ = "batches"

    id = Column(String(64), primary_key=True, index=True)
    batch_hash = Column(String(64), unique=True, index=True, nullable=False)
    submitted_by = Column(String(100), nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="processing")
    raw_data = Column(Text, nullable=False)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    records = relationship("BedTurnoverRecord", back_populates="batch")
    audit_logs = relationship("AuditLog", back_populates="batch")

class BedTurnoverRecord(Base):
    __tablename__ = "bed_turnover_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(64), ForeignKey("batches.id"), nullable=False)
    department = Column(String(100), nullable=False, index=True)
    bed_number = Column(String(20), nullable=False)
    patient_id = Column(String(50), nullable=False, index=True)
    patient_name = Column(String(100), nullable=False)
    admission_date = Column(DateTime, nullable=False)
    discharge_date = Column(DateTime)
    admission_days = Column(Integer)
    diagnosis = Column(String(200))
    surgeon = Column(String(100))
    is_effective = Column(Boolean, default=True)
    original_record_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("Batch", back_populates="records")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(64), ForeignKey("batches.id"))
    record_id = Column(Integer)
    operator = Column(String(100), nullable=False)
    operation_type = Column(String(50), nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    reason = Column(Text, nullable=False)
    operation_time = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="audit_logs")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    role = Column(String(50), default="nurse")
    hashed_password = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
