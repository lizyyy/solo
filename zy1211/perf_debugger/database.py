"""Database management for performance debugger."""

import os
from pathlib import Path
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

Base = declarative_base()


class Session(Base):
    """A performance debugging session. Groups related samples together."""
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    
    samples = relationship("Sample", back_populates="session", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="session", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="session", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_sessions_created_at', 'created_at'),
        Index('ix_sessions_start_time', 'start_time'),
    )


class Sample(Base):
    """A single sample file import (top, vmstat, etc.)."""
    __tablename__ = "samples"
    
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('sessions.id'), nullable=False)
    sample_type = Column(String(50), nullable=False)  # top, vmstat, iostat, netstat, strace, perf_script, flame_graph
    file_path = Column(String(512), nullable=False)
    file_hash = Column(String(64), nullable=False)  # For deduplication
    imported_at = Column(DateTime, default=datetime.utcnow)
    raw_content = Column(Text, nullable=True)
    
    session = relationship("Session", back_populates="samples")
    metrics = relationship("Metric", back_populates="sample", cascade="all, delete-orphan")
    records = relationship("Record", back_populates="sample", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_samples_session_id', 'session_id'),
        Index('ix_samples_sample_type', 'sample_type'),
        Index('ix_samples_file_hash', 'file_hash'),
    )


class Metric(Base):
    """Time-series metrics extracted from samples."""
    __tablename__ = "metrics"
    
    id = Column(Integer, primary_key=True)
    sample_id = Column(Integer, ForeignKey('samples.id'), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    category = Column(String(50), nullable=False)  # cpu, memory, io, network, process
    metric_name = Column(String(100), nullable=False)
    value = Column(Float, nullable=True)
    unit = Column(String(20), nullable=True)
    process_name = Column(String(255), nullable=True)
    process_pid = Column(Integer, nullable=True)
    raw_text = Column(Text, nullable=True)
    
    sample = relationship("Sample", back_populates="metrics")
    
    __table_args__ = (
        Index('ix_metrics_sample_id', 'sample_id'),
        Index('ix_metrics_timestamp', 'timestamp'),
        Index('ix_metrics_category', 'category'),
        Index('ix_metrics_metric_name', 'metric_name'),
    )


class Record(Base):
    """Structured records from samples (e.g., process list, network connections)."""
    __tablename__ = "records"
    
    id = Column(Integer, primary_key=True)
    sample_id = Column(Integer, ForeignKey('samples.id'), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    record_type = Column(String(50), nullable=False)  # process, connection, syscall, stack
    raw_data = Column(Text, nullable=False)
    
    sample = relationship("Sample", back_populates="records")
    
    __table_args__ = (
        Index('ix_records_sample_id', 'sample_id'),
        Index('ix_records_timestamp', 'timestamp'),
        Index('ix_records_record_type', 'record_type'),
    )


class Event(Base):
    """Anomaly events detected during analysis."""
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('sessions.id'), nullable=False)
    event_type = Column(String(50), nullable=False)  # cpu_spike, io_wait, network_block, syscall_block, hotspot
    severity = Column(String(20), nullable=False)  # critical, warning, info
    timestamp = Column(DateTime, nullable=False)
    end_timestamp = Column(DateTime, nullable=True)
    title = Column(String(512), nullable=False)
    description = Column(Text, nullable=True)
    related_metrics = Column(Text, nullable=True)  # JSON array of metric IDs
    related_records = Column(Text, nullable=True)  # JSON array of record IDs
    
    session = relationship("Session", back_populates="events")
    
    __table_args__ = (
        Index('ix_events_session_id', 'session_id'),
        Index('ix_events_timestamp', 'timestamp'),
        Index('ix_events_severity', 'severity'),
        Index('ix_events_event_type', 'event_type'),
    )


class Analysis(Base):
    """Analysis runs on sessions."""
    __tablename__ = "analyses"
    
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('sessions.id'), nullable=False)
    analysis_type = Column(String(50), nullable=False)  # full, cpu, io, network, compare
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    parameters = Column(Text, nullable=True)  # JSON configuration
    summary = Column(Text, nullable=True)
    
    session = relationship("Session", back_populates="analyses")
    
    __table_args__ = (
        Index('ix_analyses_session_id', 'session_id'),
        Index('ix_analyses_started_at', 'started_at'),
    )


def get_engine(db_path=None):
    """Get SQLAlchemy engine. Uses default path if not specified."""
    if db_path is None:
        home = Path.home()
        config_dir = home / ".perf-debugger"
        config_dir.mkdir(parents=True, exist_ok=True)
        db_path = config_dir / "perf-debugger.db"
    
    db_url = f"sqlite:///{db_path}"
    return create_engine(db_url, echo=False)


def get_session(db_path=None):
    """Get a database session."""
    engine = get_engine(db_path)
    Session = sessionmaker(bind=engine)
    return Session()


def init_db(db_path=None):
    """Initialize database tables."""
    engine = get_engine(db_path)
    Base.metadata.create_all(engine)
