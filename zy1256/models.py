from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class AuditSession(Base):
    __tablename__ = "audit_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    session_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    keys_file: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    events_file: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    rules_file: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    keys: Mapped[List["RedisKey"]] = relationship("RedisKey", back_populates="session")
    events: Mapped[List["UsageEvent"]] = relationship("UsageEvent", back_populates="session")
    analysis_results: Mapped[List["AnalysisResult"]] = relationship("AnalysisResult", back_populates="session")
    comparisons: Mapped[List["ComparisonResult"]] = relationship("ComparisonResult", back_populates="session")
    reports: Mapped[List["AuditReport"]] = relationship("AuditReport", back_populates="session")


class RedisKey(Base):
    __tablename__ = "redis_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("audit_sessions.id"), index=True)
    
    key_name: Mapped[str] = mapped_column(String(500), nullable=False)
    data_type: Mapped[str] = mapped_column(String(20), nullable=False)
    ttl: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    memory_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    value_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    field_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    list_length: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    set_cardinality: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    zset_cardinality: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    stream_length: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    session: Mapped["AuditSession"] = relationship("AuditSession", back_populates="keys")
    analysis: Mapped[Optional["KeyAnalysis"]] = relationship("KeyAnalysis", back_populates="redis_key", uselist=False)


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("audit_sessions.id"), index=True)
    
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    key_name: Mapped[str] = mapped_column(String(500), nullable=False)
    command: Mapped[str] = mapped_column(String(50), nullable=False)
    read_write: Mapped[str] = mapped_column(String(10), nullable=False)
    
    latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    client_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    database: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    session: Mapped["AuditSession"] = relationship("AuditSession", back_populates="events")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("audit_sessions.id"), index=True)
    
    analysis_type: Mapped[str] = mapped_column(String(50), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    total_keys: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    issues_found: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    warnings_found: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["AuditSession"] = relationship("AuditSession", back_populates="analysis_results")


class KeyAnalysis(Base):
    __tablename__ = "key_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    key_id: Mapped[int] = mapped_column(Integer, ForeignKey("redis_keys.id"), index=True, unique=True)
    
    scenario: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    recommended_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    current_type_suitability: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    estimated_memory_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    memory_optimization_potential: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    is_hot_key: Mapped[bool] = mapped_column(Boolean, default=False)
    hot_key_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_big_key: Mapped[bool] = mapped_column(Boolean, default=False)
    big_key_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    ttl_risk_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    migration_risk_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    issues: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    warnings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    suggestions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    redis_key: Mapped["RedisKey"] = relationship("RedisKey", back_populates="analysis")


class ComparisonResult(Base):
    __tablename__ = "comparison_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("audit_sessions.id"), index=True)
    
    scenario: Mapped[str] = mapped_column(String(100), nullable=False)
    current_structure: Mapped[str] = mapped_column(String(20), nullable=False)
    alternatives: Mapped[str] = mapped_column(Text, nullable=False)
    
    comparison_summary: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_structure: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["AuditSession"] = relationship("AuditSession", back_populates="comparisons")


class AuditReport(Base):
    __tablename__ = "audit_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("audit_sessions.id"), index=True)
    
    report_name: Mapped[str] = mapped_column(String(255), nullable=False)
    report_type: Mapped[str] = mapped_column(String(50), nullable=False)
    format: Mapped[str] = mapped_column(String(10), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    human_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmed_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    session: Mapped["AuditSession"] = relationship("AuditSession", back_populates="reports")
