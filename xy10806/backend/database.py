from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, ForeignKey, Text, Enum, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./oauth_revocation.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class AuthorizationStatus(str, enum.Enum):
    ACTIVE = "active"
    PENDING_REVOCATION = "pending_revocation"
    REVOKED = "revoked"
    EXPIRED = "expired"
    COMPENSATED = "compensated"
    FAILED = "failed"


class TokenStatus(str, enum.Enum):
    VALID = "valid"
    REVOKED = "revoked"
    EXPIRED = "expired"
    INVALIDATED = "invalidated"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    INTERCEPTED = "intercepted"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RevocationStatus(str, enum.Enum):
    INITIATED = "initiated"
    PROPAGATING = "propagating"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"


class ClientApplication(Base):
    __tablename__ = "client_applications"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    client_id = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    redirect_uris = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    consents = relationship("UserConsent", back_populates="application")
    tokens = relationship("AccessToken", back_populates="application")


class UserConsent(Base):
    __tablename__ = "user_consents"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    application_id = Column(String, ForeignKey("client_applications.id"), nullable=False)
    scope = Column(Text, nullable=False)
    status = Column(Enum(AuthorizationStatus), default=AuthorizationStatus.ACTIVE)
    granted_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    application = relationship("ClientApplication", back_populates="consents")
    access_tokens = relationship("AccessToken", back_populates="consent")
    revocation_events = relationship("RevocationEvent", back_populates="consent")


class AccessToken(Base):
    __tablename__ = "access_tokens"

    id = Column(String, primary_key=True, index=True)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=False)
    application_id = Column(String, ForeignKey("client_applications.id"), nullable=False)
    consent_id = Column(String, ForeignKey("user_consents.id"), nullable=False)
    scope = Column(Text)
    status = Column(Enum(TokenStatus), default=TokenStatus.VALID)
    issued_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    application = relationship("ClientApplication", back_populates="tokens")
    consent = relationship("UserConsent", back_populates="access_tokens")
    refresh_token = relationship("RefreshToken", back_populates="access_token", uselist=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String, primary_key=True, index=True)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    access_token_id = Column(String, ForeignKey("access_tokens.id"), nullable=False)
    user_id = Column(String, index=True, nullable=False)
    status = Column(Enum(TokenStatus), default=TokenStatus.VALID)
    issued_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    access_token = relationship("AccessToken", back_populates="refresh_token")


class RevocationEvent(Base):
    __tablename__ = "revocation_events"

    id = Column(String, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    consent_id = Column(String, ForeignKey("user_consents.id"), nullable=False)
    user_id = Column(String, index=True, nullable=False)
    reason = Column(Text)
    status = Column(Enum(RevocationStatus), default=RevocationStatus.INITIATED)
    initiated_by = Column(String, nullable=False)
    initiated_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    tokens_revoked = Column(Integer, default=0)
    tasks_intercepted = Column(Integer, default=0)
    error_message = Column(Text)

    consent = relationship("UserConsent", back_populates="revocation_events")
    request_log = relationship("RequestLog", back_populates="revocation_event", uselist=False)


class BackgroundTask(Base):
    __tablename__ = "background_tasks"

    id = Column(String, primary_key=True, index=True)
    task_type = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=False)
    token_id = Column(String, ForeignKey("access_tokens.id"))
    consent_id = Column(String, ForeignKey("user_consents.id"))
    payload = Column(Text)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    intercepted_at = Column(DateTime)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)


class RequestLog(Base):
    __tablename__ = "request_logs"

    id = Column(String, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    revocation_event_id = Column(String, ForeignKey("revocation_events.id"))
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)
    request_input = Column(Text, nullable=False)
    result = Column(Text)
    error = Column(Text)
    responsible_node = Column(String, nullable=False)
    status_code = Column(Integer)
    duration_ms = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    revocation_event = relationship("RevocationEvent", back_populates="request_log")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
