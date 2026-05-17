from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./bed_turnover.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Bed(Base):
    __tablename__ = "beds"
    
    id = Column(Integer, primary_key=True, index=True)
    bed_number = Column(String, unique=True, index=True)
    ward = Column(String, index=True)
    department = Column(String, index=True)
    bed_type = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, unique=True, index=True)
    name = Column(String)
    gender = Column(String)
    age = Column(Integer)
    diagnosis = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Admission(Base):
    __tablename__ = "admissions"
    
    id = Column(Integer, primary_key=True, index=True)
    admission_number = Column(String, unique=True, index=True)
    patient_id = Column(String, index=True)
    bed_id = Column(Integer, index=True)
    ward = Column(String, index=True)
    department = Column(String, index=True)
    admission_time = Column(DateTime, index=True)
    discharge_time = Column(DateTime, index=True, nullable=True)
    is_pre_discharge = Column(Boolean, default=False)
    pre_discharge_time = Column(DateTime, nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TransferRecord(Base):
    __tablename__ = "transfer_records"
    
    id = Column(Integer, primary_key=True, index=True)
    admission_number = Column(String, index=True)
    patient_id = Column(String, index=True)
    from_ward = Column(String)
    to_ward = Column(String)
    from_bed_id = Column(Integer)
    to_bed_id = Column(Integer)
    transfer_time = Column(DateTime, index=True)
    transfer_reason = Column(String, nullable=True)
    operator = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TurnoverInterval(Base):
    __tablename__ = "turnover_intervals"
    
    id = Column(Integer, primary_key=True, index=True)
    bed_id = Column(Integer, index=True)
    bed_number = Column(String)
    ward = Column(String, index=True)
    patient_id = Column(String)
    patient_name = Column(String)
    admission_number = Column(String)
    interval_start = Column(DateTime, index=True)
    interval_end = Column(DateTime, index=True)
    duration_hours = Column(Float)
    interval_type = Column(String)
    is_abnormal = Column(Boolean, default=False)
    abnormal_reason = Column(String, nullable=True)
    is_pre_discharge = Column(Boolean, default=False)
    has_transfer = Column(Boolean, default=False)
    transfer_count = Column(Integer, default=0)
    report_id = Column(String, index=True, nullable=True)
    status = Column(String, default="pending")
    needs_review = Column(Boolean, default=False)
    review_notes = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TurnoverReport(Base):
    __tablename__ = "turnover_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String, unique=True, index=True)
    report_name = Column(String)
    ward = Column(String, index=True)
    start_date = Column(DateTime, index=True)
    end_date = Column(DateTime, index=True)
    total_intervals = Column(Integer, default=0)
    abnormal_intervals = Column(Integer, default=0)
    transfer_count = Column(Integer, default=0)
    pre_discharge_count = Column(Integer, default=0)
    average_turnover_hours = Column(Float, default=0)
    status = Column(String, default="generated")
    generated_by = Column(String, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    exported_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
