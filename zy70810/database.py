from sqlalchemy import create_engine, Column, Integer, String, Date, Float, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./maintenance.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_code = Column(String, unique=True, index=True)
    device_type = Column(String)
    device_name = Column(String)
    floor = Column(String)
    area = Column(String)
    location = Column(String)
    install_date = Column(Date)
    last_maintenance_date = Column(Date)
    next_maintenance_date = Column(Date)
    status = Column(String, default="normal")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Contract(Base):
    __tablename__ = "contracts"
    
    id = Column(Integer, primary_key=True, index=True)
    contract_code = Column(String, unique=True, index=True)
    contract_name = Column(String)
    device_code = Column(String, index=True)
    vendor = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    maintenance_cycle = Column(Integer)
    amount = Column(Float)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)


class PhotoRecord(Base):
    __tablename__ = "photo_records"
    
    id = Column(Integer, primary_key=True, index=True)
    photo_code = Column(String, unique=True, index=True)
    device_code = Column(String, index=True)
    photo_name = Column(String)
    upload_date = Column(Date)
    uploader = Column(String)
    file_path = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReconciliationTask(Base):
    __tablename__ = "reconciliation_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_code = Column(String, unique=True, index=True)
    task_name = Column(String)
    status = Column(String, default="pending")
    total_devices = Column(Integer, default=0)
    matched_count = Column(Integer, default=0)
    issue_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    records = relationship("ReconciliationRecord", back_populates="task")


class ReconciliationRecord(Base):
    __tablename__ = "reconciliation_records"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("reconciliation_tasks.id"))
    device_code = Column(String, index=True)
    device_type = Column(String)
    device_name = Column(String)
    floor = Column(String)
    area = Column(String)
    
    contract_status = Column(String)
    contract_end_date = Column(Date)
    contract_count = Column(Integer, default=0)
    has_multiple_contracts = Column(Boolean, default=False)
    has_expired_contract = Column(Boolean, default=False)
    has_missing_contract = Column(Boolean, default=False)
    
    maintenance_status = Column(String)
    has_maintenance_overdue = Column(Boolean, default=False)
    last_maintenance_date = Column(Date)
    next_maintenance_date = Column(Date)
    maintenance_overdue_days = Column(Integer, default=0)
    
    photo_status = Column(String)
    photo_count = Column(Integer, default=0)
    latest_photo_date = Column(Date)
    has_photo_missing = Column(Boolean, default=False)
    
    overall_status = Column(String)
    issues = Column(Text)
    needs_review = Column(Boolean, default=False)
    is_reviewed = Column(Boolean, default=False)
    review_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    task = relationship("ReconciliationTask", back_populates="records")


class ReconciliationSummary(Base):
    __tablename__ = "reconciliation_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("reconciliation_tasks.id"))
    
    total_devices = Column(Integer, default=0)
    normal_count = Column(Integer, default=0)
    
    maintenance_overdue_count = Column(Integer, default=0)
    multiple_contracts_count = Column(Integer, default=0)
    photo_missing_count = Column(Integer, default=0)
    contract_expired_count = Column(Integer, default=0)
    
    needs_review_count = Column(Integer, default=0)
    reviewed_count = Column(Integer, default=0)
    
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
