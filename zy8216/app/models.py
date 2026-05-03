from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Float, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class AnimalStatus(str, enum.Enum):
    ACTIVE = "active"
    DECEASED = "deceased"
    TRANSFERRED = "transferred"
    IN_QUARANTINE = "in_quarantine"


class AnomalyType(str, enum.Enum):
    CAGE_CAPACITY_EXCEEDED = "cage_capacity_exceeded"
    QUARANTINE_ANIMAL_MIXED = "quarantine_animal_mixed"
    DECEASED_ANIMAL_SCANNED = "deceased_animal_scanned"
    TRANSFERRED_ANIMAL_SCANNED = "transferred_animal_scanned"
    DUPLICATE_SCAN = "duplicate_scan"


class AnomalyStatus(str, enum.Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class Animal(Base):
    __tablename__ = "animals"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(String(50), unique=True, index=True, nullable=False)
    tag_id = Column(String(50), unique=True, index=True)
    species = Column(String(50), nullable=False)
    strain = Column(String(100))
    sex = Column(String(10))
    date_of_birth = Column(DateTime)
    status = Column(String(20), default=AnimalStatus.ACTIVE.value)
    quarantine_end_date = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cage_occupancies = relationship("CageOccupancy", back_populates="animal")
    health_checks = relationship("HealthCheck", back_populates="animal")
    scan_events = relationship("CageScan", back_populates="animal")


class Cage(Base):
    __tablename__ = "cages"

    id = Column(Integer, primary_key=True, index=True)
    cage_id = Column(String(50), unique=True, index=True, nullable=False)
    location = Column(String(100))
    max_capacity = Column(Integer, default=5)
    is_quarantine = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    occupancies = relationship("CageOccupancy", back_populates="cage")
    scan_events = relationship("CageScan", back_populates="cage")


class CageOccupancy(Base):
    __tablename__ = "cage_occupancies"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)
    cage_id = Column(Integer, ForeignKey("cages.id"), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    animal = relationship("Animal", back_populates="cage_occupancies")
    cage = relationship("Cage", back_populates="occupancies")


class CageScan(Base):
    __tablename__ = "cage_scans"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(String(100), unique=True, index=True)
    tag_id = Column(String(50), nullable=False)
    animal_id = Column(Integer, ForeignKey("animals.id"))
    cage_id = Column(Integer, ForeignKey("cages.id"), nullable=False)
    scan_timestamp = Column(DateTime, nullable=False)
    scan_type = Column(String(20), default="check")
    operator = Column(String(100))
    is_duplicate = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    animal = relationship("Animal", back_populates="scan_events")
    cage = relationship("Cage", back_populates="scan_events")
    anomalies = relationship("Anomaly", back_populates="scan_event")


class HealthCheck(Base):
    __tablename__ = "health_checks"

    id = Column(Integer, primary_key=True, index=True)
    check_id = Column(String(100), unique=True, index=True)
    animal_id = Column(Integer, ForeignKey("animals.id"), nullable=False)
    check_date = Column(DateTime, nullable=False)
    weight = Column(Float)
    temperature = Column(Float)
    heart_rate = Column(Integer)
    respiratory_rate = Column(Integer)
    condition = Column(String(50))
    veterinarian = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    animal = relationship("Animal", back_populates="health_checks")


class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(100), unique=True, nullable=False)
    rule_type = Column(String(50), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_type = Column(String(50), nullable=False)
    description = Column(Text)
    scan_event_id = Column(Integer, ForeignKey("cage_scans.id"))
    animal_id = Column(Integer, ForeignKey("animals.id"))
    cage_id = Column(Integer, ForeignKey("cages.id"))
    detected_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default=AnomalyStatus.PENDING.value)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    review_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scan_event = relationship("CageScan", back_populates="anomalies")
