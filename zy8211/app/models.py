from datetime import datetime, time, timedelta
from enum import Enum
from typing import List, Optional, Tuple
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean, Text,
    create_engine, ForeignKey, Index
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sludge_dehydration.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Shift(str, Enum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    NIGHT = "night"


SHIFT_TIMES = {
    Shift.MORNING: (time(8, 0), time(16, 0)),
    Shift.AFTERNOON: (time(16, 0), time(0, 0)),
    Shift.NIGHT: (time(0, 0), time(8, 0)),
}


def get_shift(timestamp: datetime) -> Tuple[Shift, datetime]:
    dt = timestamp
    t = dt.time()
    
    if time(8, 0) <= t < time(16, 0):
        shift_date = dt.date()
        shift = Shift.MORNING
    elif time(16, 0) <= t:
        shift_date = dt.date()
        shift = Shift.AFTERNOON
    else:
        shift_date = (dt - timedelta(days=1)).date()
        shift = Shift.NIGHT
    
    shift_start = datetime.combine(shift_date, SHIFT_TIMES[shift][0])
    return shift, shift_start


class DehydratorRun(Base):
    __tablename__ = "dehydrator_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String(100), unique=True, index=True, nullable=False)
    machine_id = Column(String(50), nullable=False)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=True)
    feed_sludge_volume = Column(Float, nullable=False)
    feed_sludge_concentration = Column(Float, nullable=True)
    dry_solids_input = Column(Float, nullable=True)
    shift = Column(String(20), nullable=False)
    shift_date = Column(DateTime, nullable=False, index=True)
    batch_id = Column(String(100), ForeignKey("chemical_batches.batch_id"), nullable=True)
    imported_at = Column(DateTime, default=datetime.utcnow)
    source_file = Column(String(255), nullable=True)
    file_hash = Column(String(64), nullable=True, index=True)
    
    batch = relationship("ChemicalBatch", back_populates="runs")
    lab_results = relationship("LabMoistureResult", back_populates="run")
    reviews = relationship("ExceptionReview", back_populates="run")
    
    __table_args__ = (
        Index('idx_run_shift_date', 'shift_date', 'shift'),
    )


class ChemicalBatch(Base):
    __tablename__ = "chemical_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True, nullable=False)
    chemical_type = Column(String(50), nullable=False)
    concentration = Column(Float, nullable=False)
    dosage_rate_target = Column(Float, nullable=True)
    dosage_rate_min = Column(Float, nullable=True)
    dosage_rate_max = Column(Float, nullable=True)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=True)
    total_chemical_used = Column(Float, nullable=True)
    supplier = Column(String(100), nullable=True)
    imported_at = Column(DateTime, default=datetime.utcnow)
    source_file = Column(String(255), nullable=True)
    file_hash = Column(String(64), nullable=True, index=True)
    
    runs = relationship("DehydratorRun", back_populates="batch")


class LabMoistureResult(Base):
    __tablename__ = "lab_moisture_results"
    
    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(String(100), unique=True, index=True, nullable=False)
    sample_time = Column(DateTime, nullable=False, index=True)
    moisture_content = Column(Float, nullable=False)
    cake_solids = Column(Float, nullable=True)
    run_id = Column(String(100), ForeignKey("dehydrator_runs.run_id"), nullable=True)
    batch_id = Column(String(100), ForeignKey("chemical_batches.batch_id"), nullable=True)
    tested_by = Column(String(100), nullable=True)
    tested_at = Column(DateTime, nullable=True)
    imported_at = Column(DateTime, default=datetime.utcnow)
    source_file = Column(String(255), nullable=True)
    file_hash = Column(String(64), nullable=True, index=True)
    
    run = relationship("DehydratorRun", back_populates="lab_results")


class ExceptionType(str, Enum):
    DOSAGE_MISMATCH = "dosage_mismatch"
    FEED_SLUDGE_MISMATCH = "feed_sludge_mismatch"
    MOISTURE_EXCEED = "moisture_exceed"
    CROSS_SHIFT_BATCH = "cross_shift_batch"
    MISSING_BATCH = "missing_batch"
    MISSING_LAB_RESULT = "missing_lab_result"


class ExceptionReview(Base):
    __tablename__ = "exception_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(String(100), unique=True, index=True, nullable=False)
    run_id = Column(String(100), ForeignKey("dehydrator_runs.run_id"), nullable=False)
    exception_type = Column(String(50), nullable=False, index=True)
    exception_message = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False, index=True)
    resolution_note = Column(Text, nullable=True)
    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    run = relationship("DehydratorRun", back_populates="reviews")


class ReviewRule(Base):
    __tablename__ = "review_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(String(100), unique=True, index=True, nullable=False)
    rule_name = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False, index=True)
    threshold_value = Column(Float, nullable=True)
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    is_enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=1)
    imported_at = Column(DateTime, default=datetime.utcnow)
    source_file = Column(String(255), nullable=True)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
