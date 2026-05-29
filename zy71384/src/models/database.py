from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean,
    ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship, declarative_base

from .enums import DiagnosisStatus, BacklogCause, AlertLevel, EdgeCaseType

Base = declarative_base()


class QueueMetrics(Base):
    __tablename__ = "queue_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    diagnosis_id = Column(Integer, ForeignKey("diagnosis_records.id"), nullable=False)

    queue_name = Column(String(256), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)

    backlog_count = Column(Integer, nullable=False, default=0)
    backlog_growth_rate = Column(Float, nullable=True)

    production_rate = Column(Float, nullable=False, default=0.0)
    production_rate_avg_1h = Column(Float, nullable=True)
    production_rate_avg_24h = Column(Float, nullable=True)

    consumption_rate = Column(Float, nullable=False, default=0.0)
    consumption_rate_avg_1h = Column(Float, nullable=True)
    consumption_rate_avg_24h = Column(Float, nullable=True)

    dead_letter_count = Column(Integer, nullable=False, default=0)
    dead_letter_increment = Column(Integer, nullable=True)

    consumer_count = Column(Integer, nullable=False, default=0)
    active_consumer_count = Column(Integer, nullable=True)

    time_window_start = Column(DateTime, nullable=True)
    time_window_end = Column(DateTime, nullable=True)

    raw_data = Column(JSON, nullable=True)

    diagnosis_record = relationship("DiagnosisRecord", back_populates="metrics")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConsumerLog(Base):
    __tablename__ = "consumer_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    diagnosis_id = Column(Integer, ForeignKey("diagnosis_records.id"), nullable=False)

    consumer_id = Column(String(128), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    log_level = Column(String(32), nullable=True)
    message = Column(Text, nullable=False)

    is_heartbeat = Column(Boolean, default=False)
    is_error = Column(Boolean, default=False)
    last_seen_offset = Column(Integer, nullable=True)

    diagnosis_record = relationship("DiagnosisRecord", back_populates="consumer_logs")

    created_at = Column(DateTime, default=datetime.utcnow)


class EdgeCaseDetection(Base):
    __tablename__ = "edge_case_detections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    diagnosis_id = Column(Integer, ForeignKey("diagnosis_records.id"), nullable=False)

    edge_case_type = Column(String(64), nullable=False)  # EdgeCaseType

    human_readable_hint = Column(Text, nullable=False)
    evidence = Column(JSON, nullable=True)
    confidence = Column(Float, nullable=False, default=0.0)

    diagnosis_record = relationship("DiagnosisRecord", back_populates="edge_cases")

    created_at = Column(DateTime, default=datetime.utcnow)


class DiagnosisRecord(Base):
    __tablename__ = "diagnosis_records"

    id = Column(Integer, primary_key=True, autoincrement=True)

    queue_name = Column(String(256), nullable=False, index=True)
    status = Column(String(32), nullable=False, default=DiagnosisStatus.ENTRY)

    primary_cause = Column(String(64), nullable=True)  # BacklogCause
    alert_level = Column(String(32), nullable=True)     # AlertLevel

    overall_score = Column(Float, nullable=True)
    score_explanation = Column(Text, nullable=True)

    backlog_attribution = Column(JSON, nullable=True)
    processing_suggestions = Column(JSON, nullable=True)

    manual_review_notes = Column(Text, nullable=True)
    manual_reviewer = Column(String(128), nullable=True)
    manual_reviewed_at = Column(DateTime, nullable=True)
    manual_correction_applied = Column(Boolean, default=False)

    metrics = relationship("QueueMetrics", back_populates="diagnosis_record", order_by="QueueMetrics.timestamp")
    consumer_logs = relationship("ConsumerLog", back_populates="diagnosis_record", order_by="ConsumerLog.timestamp")
    edge_cases = relationship("EdgeCaseDetection", back_populates="diagnosis_record")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    exported_at = Column(DateTime, nullable=True)


class DiagnosisReport(Base):
    __tablename__ = "diagnosis_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    diagnosis_id = Column(Integer, ForeignKey("diagnosis_records.id"), nullable=False)

    report_format = Column(String(16), nullable=False)  # json, excel, pdf
    report_content = Column(JSON, nullable=True)
    file_path = Column(String(512), nullable=True)

    generated_by = Column(String(128), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
