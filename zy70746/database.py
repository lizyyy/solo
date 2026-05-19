from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./rollback_decision.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class RollbackStatus(str, enum.Enum):
    PENDING = "pending"
    AUTO_APPROVED = "auto_approved"
    AUTO_REJECTED = "auto_rejected"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    MANUAL_APPROVED = "manual_approved"
    MANUAL_REJECTED = "manual_rejected"
    EXECUTED = "executed"
    CANCELLED = "cancelled"


class ReleaseBatch(Base):
    __tablename__ = "release_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True)
    release_name = Column(String, index=True)
    version = Column(String)
    environment = Column(String)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    metrics = relationship("Metric", back_populates="batch")
    decisions = relationship("DecisionRecord", back_populates="batch")


class MetricType(str, enum.Enum):
    CORE = "core"
    AUXILIARY = "auxiliary"


class Metric(Base):
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, ForeignKey("release_batches.batch_id"))
    metric_name = Column(String, index=True)
    metric_type = Column(Enum(MetricType))
    current_value = Column(Float)
    baseline_value = Column(Float)
    unit = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    aggregated = Column(Boolean, default=False)
    raw_data = Column(Text)

    batch = relationship("ReleaseBatch", back_populates="metrics")


class ThresholdRule(Base):
    __tablename__ = "threshold_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String, index=True)
    metric_name = Column(String, index=True)
    metric_type = Column(Enum(MetricType))
    threshold_type = Column(String)
    threshold_value = Column(Float)
    comparison_operator = Column(String)
    weight = Column(Float, default=1.0)
    is_active = Column(Boolean, default=True)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class DecisionRecord(Base):
    __tablename__ = "decision_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, ForeignKey("release_batches.batch_id"))
    status = Column(Enum(RollbackStatus), default=RollbackStatus.PENDING)
    auto_decision = Column(String)
    auto_confidence = Column(Float)
    manual_decision = Column(String, nullable=True)
    manual_operator = Column(String, nullable=True)
    manual_reason = Column(Text, nullable=True)
    manual_timestamp = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("ReleaseBatch", back_populates="decisions")
    details = relationship("DecisionDetail", back_populates="decision")


class DecisionDetail(Base):
    __tablename__ = "decision_details"

    id = Column(Integer, primary_key=True, index=True)
    decision_id = Column(Integer, ForeignKey("decision_records.id"))
    metric_name = Column(String)
    current_value = Column(Float)
    threshold_value = Column(Float)
    passed = Column(Boolean)
    weight = Column(Float)

    decision = relationship("DecisionRecord", back_populates="details")


class RollbackSummary(Base):
    __tablename__ = "rollback_summaries"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, index=True)
    release_name = Column(String)
    version = Column(String)
    environment = Column(String)
    final_decision = Column(String)
    decision_method = Column(String)
    operator = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    metrics_summary = Column(Text)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration_seconds = Column(Integer)
    exported_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
