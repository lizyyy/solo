from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class FixtureStatus(str, enum.Enum):
    PENDING = "pending"
    RECORDED = "recorded"
    NORMALIZED = "normalized"
    VERIFIED = "verified"
    REPLAY_READY = "replay_ready"
    REPLAYED = "replayed"
    CLOSED = "closed"
    WITHDRAWN = "withdrawn"


class FixtureExceptionType(str, enum.Enum):
    SIGNATURE_MISMATCH = "signature_mismatch"
    PAYLOAD_INVALID = "payload_invalid"
    TIMESTAMP_EXPIRED = "timestamp_expired"
    DUPLICATE = "duplicate"
    OTHER = "other"


class WebhookFixture(Base):
    __tablename__ = "webhook_fixtures"

    id = Column(Integer, primary_key=True, index=True)
    fixture_id = Column(String, unique=True, index=True)
    request_method = Column(String)
    request_url = Column(String)
    request_headers = Column(JSON)
    signature_headers = Column(JSON)
    raw_payload = Column(Text)
    normalized_payload = Column(Text)
    timestamp = Column(DateTime)
    status = Column(String, default=FixtureStatus.PENDING)
    fixture_directory = Column(String)
    handler = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    exceptions = relationship("FixtureException", back_populates="fixture", cascade="all, delete-orphan")
    reports = relationship("RecordingReport", back_populates="fixture", cascade="all, delete-orphan")


class FixtureException(Base):
    __tablename__ = "fixture_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    fixture_id = Column(Integer, ForeignKey("webhook_fixtures.id"))
    exception_type = Column(String)
    raw_input = Column(Text)
    handler = Column(String)
    conclusion = Column(Text)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    fixture = relationship("WebhookFixture", back_populates="exceptions")


class RecordingReport(Base):
    __tablename__ = "recording_reports"

    id = Column(Integer, primary_key=True, index=True)
    fixture_id = Column(Integer, ForeignKey("webhook_fixtures.id"))
    report_content = Column(Text)
    replay_script_path = Column(String)
    exported_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    fixture = relationship("WebhookFixture", back_populates="reports")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
