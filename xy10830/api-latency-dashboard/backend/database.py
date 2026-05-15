from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "api_latency.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, unique=True, index=True)
    api_path = Column(String, index=True)
    status = Column(String, index=True)
    severity = Column(String)
    avg_latency = Column(Float)
    p95_latency = Column(Float)
    p99_latency = Column(Float)
    total_requests = Column(Integer)
    slow_requests = Column(Integer)
    affected_tenants = Column(Integer)
    tenant_list = Column(Text)
    start_time = Column(DateTime)
    end_time = Column(DateTime, nullable=True)
    current_bucket = Column(String)
    recovery_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    samples = relationship("SlowRequestSample", back_populates="incident")
    timeline = relationship("IncidentTimeline", back_populates="incident")
    remarks = relationship("TroubleshootRemark", back_populates="incident")


class SlowRequestSample(Base):
    __tablename__ = "slow_request_samples"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.incident_id"))
    request_id = Column(String)
    tenant_id = Column(String, index=True)
    latency = Column(Float)
    timestamp = Column(DateTime)
    http_method = Column(String)
    status_code = Column(Integer)
    user_agent = Column(String, nullable=True)
    client_ip = Column(String, nullable=True)

    incident = relationship("Incident", back_populates="samples")


class IncidentTimeline(Base):
    __tablename__ = "incident_timeline"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.incident_id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String)
    event_message = Column(Text)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=True)
    operator = Column(String, nullable=True)

    incident = relationship("Incident", back_populates="timeline")


class TroubleshootRemark(Base):
    __tablename__ = "troubleshoot_remarks"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.incident_id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    author = Column(String)
    content = Column(Text)
    is_resolution = Column(Boolean, default=False)

    incident = relationship("Incident", back_populates="remarks")


class LatencyBucket(Base):
    __tablename__ = "latency_buckets"

    id = Column(Integer, primary_key=True, index=True)
    bucket_name = Column(String, unique=True)
    min_latency = Column(Integer)
    max_latency = Column(Integer)
    severity = Column(String)
    color = Column(String)


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    buckets = [
        {"bucket_name": "NORMAL", "min_latency": 0, "max_latency": 500, "severity": "info", "color": "#10b981"},
        {"bucket_name": "WARNING", "min_latency": 500, "max_latency": 1000, "severity": "warning", "color": "#f59e0b"},
        {"bucket_name": "ALERT", "min_latency": 1000, "max_latency": 3000, "severity": "error", "color": "#ef4444"},
        {"bucket_name": "CRITICAL", "min_latency": 3000, "max_latency": 10000, "severity": "critical", "color": "#7c3aed"},
        {"bucket_name": "FATAL", "min_latency": 10000, "max_latency": 999999, "severity": "fatal", "color": "#000000"},
    ]
    
    for bucket in buckets:
        existing = db.query(LatencyBucket).filter(LatencyBucket.bucket_name == bucket["bucket_name"]).first()
        if not existing:
            db.add(LatencyBucket(**bucket))
    
    db.commit()
    db.close()
