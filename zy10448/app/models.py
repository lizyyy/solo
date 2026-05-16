from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class IncidentStatus(str, enum.Enum):
    DETECTED = "detected"
    ANALYZING = "analyzing"
    CONFIRMED = "confirmed"
    RESOLVED = "resolved"
    CLOSED = "closed"

class ClueSource(str, enum.Enum):
    MONITORING = "monitoring"
    LOG = "log"
    MANUAL = "manual"
    CORRELATION = "correlation"

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    usage_metrics = relationship("UsageMetric", back_populates="tenant", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="tenant", cascade="all, delete-orphan")

class UsageMetric(Base):
    __tablename__ = "usage_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    metric_name = Column(String, nullable=False)
    metric_value = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    baseline_value = Column(Float)
    deviation_percent = Column(Float)
    raw_data = Column(Text)
    
    tenant = relationship("Tenant", back_populates="usage_metrics")
    anomaly_windows = relationship("AnomalyWindow", back_populates="usage_metric", cascade="all, delete-orphan")

class AnomalyWindow(Base):
    __tablename__ = "anomaly_windows"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    usage_metric_id = Column(Integer, ForeignKey("usage_metrics.id"), nullable=False)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    peak_value = Column(Float, nullable=False)
    baseline_value = Column(Float, nullable=False)
    deviation_percent = Column(Float, nullable=False)
    severity = Column(String, nullable=False)
    
    incident = relationship("Incident", back_populates="anomaly_windows")
    usage_metric = relationship("UsageMetric", back_populates="anomaly_windows")

class AttributionClue(Base):
    __tablename__ = "attribution_clues"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    clue_key = Column(String, nullable=False)
    source = Column(Enum(ClueSource), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    confidence = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(Text)
    is_manual = Column(Boolean, default=False)
    
    incident = relationship("Incident", back_populates="attribution_clues")
    actions = relationship("ActionItem", back_populates="clue", cascade="all, delete-orphan")

class ActionItem(Base):
    __tablename__ = "action_items"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    clue_id = Column(Integer, ForeignKey("attribution_clues.id"))
    action_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    owner = Column(String)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    result = Column(Text)
    
    incident = relationship("Incident", back_populates="action_items")
    clue = relationship("AttributionClue", back_populates="actions")

class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    incident_key = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(Enum(IncidentStatus), default=IncidentStatus.DETECTED)
    severity = Column(String, default="medium")
    detected_at = Column(DateTime, default=datetime.utcnow)
    confirmed_at = Column(DateTime)
    resolved_at = Column(DateTime)
    closed_at = Column(DateTime)
    original_input = Column(Text)
    processing_result = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    tenant = relationship("Tenant", back_populates="incidents")
    anomaly_windows = relationship("AnomalyWindow", back_populates="incident", cascade="all, delete-orphan")
    attribution_clues = relationship("AttributionClue", back_populates="incident", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="incident", cascade="all, delete-orphan")
    summary = relationship("IncidentSummary", back_populates="incident", uselist=False, cascade="all, delete-orphan")

class IncidentSummary(Base):
    __tablename__ = "incident_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), unique=True, nullable=False)
    root_cause = Column(Text)
    impact_assessment = Column(Text)
    resolution_summary = Column(Text)
    lessons_learned = Column(Text)
    exported_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    incident = relationship("Incident", back_populates="summary")
