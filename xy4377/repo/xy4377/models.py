from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database import Base
import enum
from datetime import datetime


class RiskType(enum.Enum):
    CIRCUIT_OVERLOAD = "circuit_overload"
    PHASE_IMBALANCE = "phase_imbalance"
    GENERATOR_INSUFFICIENT = "generator_insufficient"
    RCD_MISSING = "rcd_missing"
    DRILL_INCOMPLETE = "drill_incomplete"


class RiskSeverity(enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RiskStatus(enum.Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"
    MANUAL_OVERRIDE = "manual_override"


class Stall(Base):
    __tablename__ = "stalls"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    location = Column(String(255))
    power_required_kw = Column(Float, nullable=False)
    circuit_id = Column(Integer, ForeignKey("circuits.id"))
    is_rain_protected = Column(Boolean, default=False)
    has_rcd_protection = Column(Boolean, default=True)
    is_critical = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    circuit = relationship("Circuit", back_populates="stalls")


class Circuit(Base):
    __tablename__ = "circuits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    panel_name = Column(String(255))
    phase = Column(String(50))
    max_capacity_kw = Column(Float, nullable=False)
    generator_id = Column(Integer, ForeignKey("generators.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    generator = relationship("Generator", back_populates="circuits")
    stalls = relationship("Stall", back_populates="circuit")


class Generator(Base):
    __tablename__ = "generators"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    capacity_kw = Column(Float, nullable=False)
    redundancy_threshold = Column(Float, default=0.3)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    circuits = relationship("Circuit", back_populates="generator")


class DrillRecord(Base):
    __tablename__ = "drill_records"

    id = Column(Integer, primary_key=True, index=True)
    drill_date = Column(DateTime, nullable=False)
    circuits_tested = Column(Text)
    stages_tested = Column(Text)
    critical_stages = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class RiskResult(Base):
    __tablename__ = "risk_results"

    id = Column(Integer, primary_key=True, index=True)
    risk_type = Column(Enum(RiskType), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(Enum(RiskSeverity), nullable=False)
    status = Column(Enum(RiskStatus), default=RiskStatus.OPEN)
    circuit_id = Column(Integer, ForeignKey("circuits.id"), nullable=True)
    stall_id = Column(Integer, ForeignKey("stalls.id"), nullable=True)
    generator_id = Column(Integer, ForeignKey("generators.id"), nullable=True)
    calculated_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    manual_override = Column(Boolean, default=False)
    override_reason = Column(Text, nullable=True)
    overridden_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReviewComment(Base):
    __tablename__ = "review_comments"

    id = Column(Integer, primary_key=True, index=True)
    risk_id = Column(Integer, ForeignKey("risk_results.id"), nullable=False)
    reviewer = Column(String(255), nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
