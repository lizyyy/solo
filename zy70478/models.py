from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

SQLALCHEMY_DATABASE_URL = "sqlite:///./event_converger.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ConvergenceRule(Base):
    __tablename__ = "convergence_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), unique=True, index=True)
    rule_name = Column(String(200))
    description = Column(Text)
    success_conditions = Column(JSON)
    failure_conditions = Column(JSON)
    risk_weightings = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100), default="system")
    
    batches = relationship("EventBatch", back_populates="applied_rule")


class EventBatch(Base):
    __tablename__ = "event_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True)
    batch_hash = Column(String(64), index=True)
    source = Column(String(200))
    description = Column(Text)
    total_events = Column(Integer)
    rule_version = Column(String(50), ForeignKey("convergence_rules.version"))
    processing_status = Column(String(50), default="pending")
    processing_started_at = Column(DateTime)
    processing_completed_at = Column(DateTime)
    processing_duration_ms = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    applied_rule = relationship("ConvergenceRule", back_populates="batches")
    events = relationship("Event", back_populates="batch", cascade="all, delete-orphan")
    reports = relationship("ProcessingReport", back_populates="batch", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(100), index=True)
    batch_id = Column(String(100), ForeignKey("event_batches.batch_id"))
    original_data = Column(JSON)
    processed_data = Column(JSON)
    raw_status = Column(String(100))
    final_status = Column(String(100))
    risk_level = Column(String(50))
    risk_score = Column(Float)
    is_merged = Column(Boolean, default=False)
    merged_into_event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    corrections = Column(JSON)
    processing_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("EventBatch", back_populates="events")
    merged_events = relationship("Event", remote_side=[id])


class ProcessingReport(Base):
    __tablename__ = "processing_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), ForeignKey("event_batches.batch_id"))
    report_type = Column(String(50))
    before_summary = Column(JSON)
    after_summary = Column(JSON)
    comparison_details = Column(JSON)
    execution_time_ms = Column(Float)
    next_steps = Column(JSON)
    summary_stats = Column(JSON)
    generated_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("EventBatch", back_populates="reports")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100))
    entity_type = Column(String(100))
    entity_id = Column(String(100))
    old_value = Column(JSON)
    new_value = Column(JSON)
    changed_by = Column(String(100), default="system")
    changed_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text)


class OutsourcingAcceptance(Base):
    __tablename__ = "outsourcing_acceptances"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    batch_id = Column(String(100))
    original_value = Column(JSON)
    corrected_value = Column(JSON)
    correction_reason = Column(Text)
    risk_level = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)
