from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base


class EntryAPI(Base):
    __tablename__ = "entry_apis"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False, index=True)
    method = Column(String(16), nullable=False)
    path = Column(String(256), nullable=False, index=True)
    description = Column(Text)
    status = Column(String(32), default="CREATED")
    risk_level = Column(String(32), default="UNKNOWN")
    risk_description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    downstream_services = relationship("DownstreamService", back_populates="entry_api", cascade="all, delete-orphan")
    call_samples = relationship("CallSample", back_populates="entry_api", cascade="all, delete-orphan")
    history_records = relationship("HistoryRecord", back_populates="entry_api", cascade="all, delete-orphan")


class DownstreamService(Base):
    __tablename__ = "downstream_services"

    id = Column(String(64), primary_key=True, index=True)
    entry_api_id = Column(String(64), ForeignKey("entry_apis.id"), nullable=False)
    service_name = Column(String(128), nullable=False, index=True)
    service_type = Column(String(64))
    endpoint = Column(String(256))
    method = Column(String(16))
    cache_key = Column(String(256), index=True)
    cache_ttl = Column(Integer)
    call_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    avg_latency = Column(Float, default=0.0)
    p50_latency = Column(Float, default=0.0)
    p95_latency = Column(Float, default=0.0)
    p99_latency = Column(Float, default=0.0)
    risk_level = Column(String(32), default="UNKNOWN")
    risk_description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    entry_api = relationship("EntryAPI", back_populates="downstream_services")
    latency_distribution = relationship("LatencyDistribution", back_populates="service", cascade="all, delete-orphan")


class CallSample(Base):
    __tablename__ = "call_samples"

    id = Column(String(64), primary_key=True, index=True)
    entry_api_id = Column(String(64), ForeignKey("entry_apis.id"), nullable=False)
    trace_id = Column(String(128), unique=True, index=True)
    request_id = Column(String(128), index=True)
    user_id = Column(String(64), index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    status = Column(String(32), nullable=False)
    total_latency = Column(Float, nullable=False)
    category = Column(String(64), index=True)
    request_data = Column(JSON)
    response_data = Column(JSON)
    error_message = Column(Text)
    error_stack = Column(Text)
    downstream_calls = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    entry_api = relationship("EntryAPI", back_populates="call_samples")


class LatencyDistribution(Base):
    __tablename__ = "latency_distributions"

    id = Column(String(64), primary_key=True, index=True)
    service_id = Column(String(64), ForeignKey("downstream_services.id"), nullable=False)
    bucket = Column(String(64), nullable=False)
    min_ms = Column(Float, nullable=False)
    max_ms = Column(Float, nullable=False)
    count = Column(Integer, default=0)
    percentage = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    service = relationship("DownstreamService", back_populates="latency_distribution")


class HistoryRecord(Base):
    __tablename__ = "history_records"

    id = Column(String(64), primary_key=True, index=True)
    entry_api_id = Column(String(64), ForeignKey("entry_apis.id"), nullable=False)
    action = Column(String(64), nullable=False, index=True)
    operator = Column(String(64), default="system")
    previous_status = Column(String(32))
    new_status = Column(String(32))
    change_reason = Column(Text)
    details = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    entry_api = relationship("EntryAPI", back_populates="history_records")


class RequestDeduplication(Base):
    __tablename__ = "request_deduplication"

    id = Column(String(64), primary_key=True, index=True)
    request_hash = Column(String(128), unique=True, index=True, nullable=False)
    entry_api_id = Column(String(64), index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    processed = Column(Boolean, default=True)
