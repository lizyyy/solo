from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./backup_restore.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class RestoreRecord(Base):
    __tablename__ = "restore_records"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="pending_approval", index=True)
    backup_point_id = Column(String(100), nullable=False)
    backup_point_time = Column(DateTime, nullable=False)
    source_environment = Column(String(100), nullable=False)
    target_environment = Column(String(100), nullable=False)
    restore_scope = Column(JSON, nullable=False)
    applicant = Column(String(100), nullable=False)
    applicant_email = Column(String(100))
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    scheduled_time = Column(DateTime)
    completed_at = Column(DateTime)
    rollback_available = Column(Boolean, default=False)
    verification_required = Column(Boolean, default=True)

    approvals = relationship("Approval", back_populates="record", cascade="all, delete-orphan")
    execution_steps = relationship("ExecutionStep", back_populates="record", cascade="all, delete-orphan")
    verification_results = relationship("VerificationResult", back_populates="record", cascade="all, delete-orphan")
    change_logs = relationship("ChangeLog", back_populates="record", cascade="all, delete-orphan")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("restore_records.id"), nullable=False)
    approver = Column(String(100), nullable=False)
    approval_type = Column(String(50), nullable=False)
    status = Column(String(50), default="pending")
    comment = Column(Text)
    approved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("RestoreRecord", back_populates="approvals")


class ExecutionStep(Base):
    __tablename__ = "execution_steps"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("restore_records.id"), nullable=False)
    step_number = Column(Integer, nullable=False)
    step_name = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="pending")
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    result = Column(Text)
    error_message = Column(Text)
    rollback_script = Column(Text)

    record = relationship("RestoreRecord", back_populates="execution_steps")


class VerificationResult(Base):
    __tablename__ = "verification_results"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("restore_records.id"), nullable=False)
    verification_type = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="pending")
    expected_value = Column(Text)
    actual_value = Column(Text)
    passed = Column(Boolean)
    verified_by = Column(String(100))
    verified_at = Column(DateTime)
    remarks = Column(Text)

    record = relationship("RestoreRecord", back_populates="verification_results")


class ChangeLog(Base):
    __tablename__ = "change_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("restore_records.id"), nullable=False)
    action = Column(String(100), nullable=False)
    previous_status = Column(String(50))
    new_status = Column(String(50))
    changed_by = Column(String(100), nullable=False)
    comment = Column(Text)
    changed_at = Column(DateTime, default=datetime.utcnow)
    details = Column(JSON)

    record = relationship("RestoreRecord", back_populates="change_logs")


class BackupPoint(Base):
    __tablename__ = "backup_points"

    id = Column(Integer, primary_key=True, index=True)
    backup_id = Column(String(100), unique=True, nullable=False, index=True)
    environment = Column(String(100), nullable=False)
    backup_time = Column(DateTime, nullable=False)
    size = Column(String(50))
    databases = Column(JSON)
    tables = Column(JSON)
    storage_path = Column(String(500))
    status = Column(String(50), default="available")
    created_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text)
