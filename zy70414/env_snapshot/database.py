import os
from datetime import datetime
from typing import Optional, List
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import enum

DB_PATH = os.path.expanduser("~/.env-snapshot/env_snapshot.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class RiskType(enum.Enum):
    SIGNATURE_MISMATCH = "signature_mismatch"
    ALGORITHM_MISMATCH = "algorithm_mismatch"
    MISSING_SUPPLIER = "missing_supplier"
    DATA_CORRUPTION = "data_corruption"


class ActionType(enum.Enum):
    ADD_SUPPLIER = "add_supplier"
    UPDATE_SIGNATURE = "update_signature"
    VERIFY_SNAPSHOT = "verify_snapshot"
    GENERATE_REPORT = "generate_report"
    RERUN = "rerun"


class Status(enum.Enum):
    PENDING = "pending"
    PREVIEW = "preview"
    EXECUTED = "executed"
    FAILED = "failed"
    VERIFIED = "verified"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True)
    operator = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text, nullable=True)
    status = Column(String, default=Status.PENDING.value)

    actions = relationship("ActionLog", back_populates="batch")
    snapshots = relationship("EnvSnapshot", back_populates="batch")


class EnvSnapshot(Base):
    __tablename__ = "env_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(String, unique=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    supplier_name = Column(String, index=True)
    env_vars = Column(Text)
    signature = Column(String)
    algorithm = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    operator = Column(String)
    material_summary = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)
    rerun_marker = Column(String, nullable=True)

    batch = relationship("Batch", back_populates="snapshots")
    error_samples = relationship("ErrorSample", back_populates="snapshot")


class ActionLog(Base):
    __tablename__ = "action_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    action_type = Column(String)
    input_data = Column(Text)
    output_data = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)
    operator = Column(String)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    rerun_marker = Column(String, nullable=True)
    parent_action_id = Column(Integer, nullable=True)

    batch = relationship("Batch", back_populates="actions")


class ErrorSample(Base):
    __tablename__ = "error_samples"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("env_snapshots.id"))
    risk_type = Column(String)
    description = Column(Text)
    sample_data = Column(Text)
    identified_at = Column(DateTime, default=datetime.utcnow)
    severity = Column(String)

    snapshot = relationship("EnvSnapshot", back_populates="error_samples")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    contact_info = Column(Text, nullable=True)
    algorithm = Column(String, default="SHA256")
    public_key = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(Text, nullable=True)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
