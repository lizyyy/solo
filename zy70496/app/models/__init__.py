from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Integer, ForeignKey, Text, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./evidence_auth.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class RiskType(str, enum.Enum):
    DATA_LEAKAGE = "data_leakage"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    MALWARE = "malware"
    POLICY_VIOLATION = "policy_violation"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"
    CONFLICT = "conflict"


class EvidenceSource(str, enum.Enum):
    SECURITY_LOG = "security_log"
    NETWORK_TRAFFIC = "network_traffic"
    ENDPOINT_LOG = "endpoint_log"
    ACCESS_LOG = "access_log"
    DATABASE_AUDIT = "database_audit"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(String, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    environment_name = Column(String, index=True, nullable=False)
    operator = Column(String, index=True, nullable=False)
    risk_type = Column(String, index=True, nullable=False)
    status = Column(String, nullable=False, default=ProcessingStatus.PENDING)
    description = Column(Text)
    original_input = Column(Text)
    processing_basis = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    evidence_records = relationship("EvidenceRecord", back_populates="batch")
    authorizations = relationship("DownloadAuthorization", back_populates="batch")


class EvidenceRecord(Base):
    __tablename__ = "evidence_records"

    id = Column(String, primary_key=True, index=True)
    batch_id = Column(String, ForeignKey("batches.id"), nullable=False)
    evidence_id = Column(String, index=True, nullable=False)
    source = Column(String, nullable=False)
    device_name = Column(String, index=True)
    device_ip = Column(String)
    risk_level = Column(String)
    evidence_path = Column(String)
    evidence_hash = Column(String)
    collected_at = Column(DateTime)
    status = Column(String, nullable=False, default=ProcessingStatus.PENDING)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="evidence_records")


class DownloadAuthorization(Base):
    __tablename__ = "download_authorizations"

    id = Column(String, primary_key=True, index=True)
    batch_id = Column(String, ForeignKey("batches.id"), nullable=False)
    authorized_by = Column(String, nullable=False)
    authorized_to = Column(String, nullable=False, index=True)
    authorized_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime)
    used_by = Column(String, index=True)
    reason = Column(Text)

    batch = relationship("Batch", back_populates="authorizations")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
