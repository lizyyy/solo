
import enum
from datetime import datetime
from typing import Optional, List
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.sql import func

Base = declarative_base()


class ImportStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class ScanStatus(enum.Enum):
    PENDING = "pending"
    SCANNING = "scanning"
    COMPLETED = "completed"
    FAILED = "failed"


class ReviewResult(enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    APPEALED = "appealed"


class RuleType(enum.Enum):
    APOLOGY_MISSING = "apology_missing"
    REFUND_PROMISE_MISSING = "refund_promise_missing"
    SENSITIVE_WORD = "sensitive_word"
    SPEAKER_MISSING = "speaker_missing"
    TIMESTAMP_OVERLAP = "timestamp_overlap"
    CUSTOM = "custom"


class RuleAction(enum.Enum):
    BLOCK = "block"
    PASS = "pass"
    WARN = "warn"


class BatchImport(Base):
    __tablename__ = "batch_imports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_no = Column(String(64), unique=True, nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(String(32), default=ImportStatus.PENDING.value)
    error_message = Column(Text, nullable=True)
    created_by = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    transcripts = relationship("Transcript", back_populates="batch_import", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<BatchImport {self.batch_no}>"


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transcript_id = Column(String(64), unique=True, nullable=False, index=True)
    batch_import_id = Column(Integer, ForeignKey("batch_imports.id"), nullable=True)
    session_id = Column(String(64), nullable=False, index=True)
    agent_id = Column(String(64), nullable=True, index=True)
    customer_id = Column(String(64), nullable=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    duration = Column(Float, nullable=True)
    raw_content = Column(Text, nullable=False)
    is_scanned = Column(Boolean, default=False)
    scan_status = Column(String(32), default=ScanStatus.PENDING.value)
    scanned_at = Column(DateTime, nullable=True)
    has_issues = Column(Boolean, default=False)
    issue_count = Column(Integer, default=0)
    rule_version = Column(String(32), nullable=True)
    review_status = Column(String(32), default=ReviewResult.PENDING.value)
    reviewed_by = Column(String(64), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    extra_data = Column(JSON, default=dict)

    batch_import = relationship("BatchImport", back_populates="transcripts")
    utterances = relationship("Utterance", back_populates="transcript", cascade="all, delete-orphan")
    scan_results = relationship("ScanResult", back_populates="transcript", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Transcript {self.transcript_id}>"


class Utterance(Base):
    __tablename__ = "utterances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transcript_id = Column(Integer, ForeignKey("transcripts.id"), nullable=False)
    utterance_index = Column(Integer, nullable=False)
    speaker = Column(String(64), nullable=True)
    speaker_role = Column(String(32), nullable=True)
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())

    transcript = relationship("Transcript", back_populates="utterances")

    __mapper_args__ = {
        "confirm_deleted_rows": False
    }

    def __repr__(self):
        return f"<Utterance {self.id}>"


class QualityRule(Base):
    __tablename__ = "quality_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_code = Column(String(64), unique=True, nullable=False, index=True)
    rule_name = Column(String(255), nullable=False)
    rule_type = Column(String(64), nullable=False)
    description = Column(Text, nullable=True)
    rule_config = Column(JSON, default=dict)
    action = Column(String(32), default=RuleAction.BLOCK.value)
    severity = Column(Integer, default=1)
    is_enabled = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    created_by = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    scan_results = relationship("ScanResult", back_populates="rule")

    def __repr__(self):
        return f"<QualityRule {self.rule_code} v{self.version}>"


class ScanResult(Base):
    __tablename__ = "scan_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transcript_id = Column(Integer, ForeignKey("transcripts.id"), nullable=False)
    rule_id = Column(Integer, ForeignKey("quality_rules.id"), nullable=False)
    utterance_id = Column(Integer, ForeignKey("utterances.id"), nullable=True)
    rule_code = Column(String(64), nullable=False)
    rule_type = Column(String(64), nullable=False)
    rule_version = Column(Integer, nullable=False)
    action = Column(String(32), nullable=False)
    matched_text = Column(Text, nullable=True)
    reason = Column(Text, nullable=False)
    severity = Column(Integer, default=1)
    position_start = Column(Integer, nullable=True)
    position_end = Column(Integer, nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(64), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())

    transcript = relationship("Transcript", back_populates="scan_results")
    rule = relationship("QualityRule", back_populates="scan_results")
    utterance = relationship("Utterance")

    def __repr__(self):
        return f"<ScanResult {self.id}>"


class ScanBatch(Base):
    __tablename__ = "scan_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_no = Column(String(64), unique=True, nullable=False, index=True)
    total_transcripts = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    rule_version = Column(String(32), nullable=True)
    status = Column(String(32), default=ScanStatus.PENDING.value)
    error_details = Column(JSON, default=list)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_by = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=func.now())

    def __repr__(self):
        return f"<ScanBatch {self.batch_no}>"


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    export_no = Column(String(64), unique=True, nullable=False, index=True)
    export_type = Column(String(64), nullable=False)
    filters = Column(JSON, default=dict)
    total_records = Column(Integer, default=0)
    file_path = Column(String(255), nullable=True)
    status = Column(String(32), default="pending")
    error_message = Column(Text, nullable=True)
    created_by = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=func.now())

    def __repr__(self):
        return f"<ExportRecord {self.export_no}>"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action = Column(String(128), nullable=False)
    resource_type = Column(String(64), nullable=True)
    resource_id = Column(String(64), nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    operator = Column(String(64), nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=func.now())

    def __repr__(self):
        return f"<AuditLog {self.action}>"


def init_db(db_url="sqlite:///quality_check.db"):
    engine = create_engine(db_url, echo=False)
    Base.metadata.create_all(engine)
    return engine


def get_session(engine):
    Session = sessionmaker(bind=engine)
    return Session()


if __name__ == "__main__":
    engine = init_db()
    print("Database initialized successfully!")
