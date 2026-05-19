from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Float, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./incident_usage.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class IncidentStatus:
    CREATED = "created"
    INVESTIGATING = "investigating"
    ATTRIBUTED = "attributed"
    RESOLVED = "resolved"
    CLOSED = "closed"
    WITHDRAWN = "withdrawn"


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    tenant_name = Column(String, nullable=False)
    metric_name = Column(String, nullable=False)
    metric_value = Column(Float, nullable=False)
    baseline_value = Column(Float, nullable=False)
    deviation_ratio = Column(Float, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String, default=IncidentStatus.CREATED)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=False)
    raw_input = Column(Text, nullable=True)

    clues = relationship("AttributionClue", back_populates="incident", cascade="all, delete-orphan")
    actions = relationship("ProcessAction", back_populates="incident", cascade="all, delete-orphan")


class AttributionClue(Base):
    __tablename__ = "attribution_clues"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False)
    source_system = Column(String, nullable=False)
    clue_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    confidence = Column(Float, default=0.0)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, nullable=False)

    incident = relationship("Incident", back_populates="clues")


class ProcessAction(Base):
    __tablename__ = "process_actions"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False)
    action_type = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    conclusion = Column(Text, nullable=True)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="actions")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
