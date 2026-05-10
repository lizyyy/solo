from datetime import datetime, timedelta
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text,
    Float, Index, Enum as SQLAlchemyEnum
)
from sqlalchemy.orm import relationship, declarative_base
from enum import Enum

Base = declarative_base()


class KeyStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    BANNED = "banned"


class QuotaPeriod(str, Enum):
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"


class DecisionResult(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    PENDING_REVIEW = "pending_review"


class DecisionReason(str, Enum):
    QUOTA_EXCEEDED = "quota_exceeded"
    IP_BLOCKED = "ip_blocked"
    IP_NOT_WHITELISTED = "ip_not_whitelisted"
    KEY_INVALID = "key_inactive"
    KEY_SUSPENDED = "key_suspended"
    KEY_BANNED = "key_banned"
    SUSPICIOUS_PATTERN = "suspicious_pattern"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    NORMAL = "normal"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class IPActionType(str, Enum):
    WHITELIST = "whitelist"
    BLACKLIST = "blacklist"


class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    key_value = Column(String(64), unique=True, index=True, nullable=False)
    app_id = Column(String(64), index=True, nullable=False)
    developer_id = Column(String(64), index=True, nullable=False)
    description = Column(Text, nullable=True)
    
    status = Column(SQLAlchemyEnum(KeyStatus), default=KeyStatus.ACTIVE, nullable=False)
    is_ip_restricted = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    
    quota_buckets = relationship("QuotaBucket", back_populates="api_key", cascade="all, delete-orphan")
    ip_rules = relationship("IPRule", back_populates="api_key", cascade="all, delete-orphan")
    call_logs = relationship("CallLog", back_populates="api_key", cascade="all, delete-orphan")
    decision_logs = relationship("DecisionLog", back_populates="api_key", cascade="all, delete-orphan")
    suspension_records = relationship("SuspensionRecord", back_populates="api_key", cascade="all, delete-orphan")


class QuotaBucket(Base):
    __tablename__ = "quota_buckets"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), index=True, nullable=False)
    
    api_endpoint = Column(String(256), index=True, nullable=True)
    period = Column(SQLAlchemyEnum(QuotaPeriod), nullable=False)
    limit = Column(Integer, nullable=False)
    used = Column(Integer, default=0, nullable=False)
    reset_at = Column(DateTime, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    api_key = relationship("APIKey", back_populates="quota_buckets")
    
    __table_args__ = (
        Index('ix_quota_bucket_key_period_endpoint', 'api_key_id', 'period', 'api_endpoint', unique=True),
    )


class IPRule(Base):
    __tablename__ = "ip_rules"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), index=True, nullable=False)
    
    ip_address = Column(String(64), index=True, nullable=False)
    action = Column(SQLAlchemyEnum(IPActionType), nullable=False)
    description = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    
    api_key = relationship("APIKey", back_populates="ip_rules")
    
    __table_args__ = (
        Index('ix_ip_rule_key_ip', 'api_key_id', 'ip_address', 'action', unique=True),
    )


class CallLog(Base):
    __tablename__ = "call_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), index=True, nullable=False)
    
    api_endpoint = Column(String(256), index=True, nullable=True)
    ip_address = Column(String(64), index=True, nullable=True)
    status_code = Column(Integer, nullable=False)
    response_time_ms = Column(Integer, nullable=True)
    
    request_timestamp = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    
    api_key = relationship("APIKey", back_populates="call_logs")


class DecisionLog(Base):
    __tablename__ = "decision_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), index=True, nullable=False)
    
    request_id = Column(String(64), index=True, nullable=False)
    result = Column(SQLAlchemyEnum(DecisionResult), nullable=False)
    reason = Column(SQLAlchemyEnum(DecisionReason), nullable=False)
    details = Column(Text, nullable=True)
    
    ip_address = Column(String(64), nullable=True)
    api_endpoint = Column(String(256), nullable=True)
    
    previous_decision_id = Column(Integer, ForeignKey("decision_logs.id"), nullable=True)
    is_latest = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    
    api_key = relationship("APIKey", back_populates="decision_logs")
    previous_decision = relationship("DecisionLog", remote_side=[id])


class SuspensionRecord(Base):
    __tablename__ = "suspension_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), index=True, nullable=False)
    
    suspension_type = Column(String(32), nullable=False)
    reason = Column(Text, nullable=True)
    reason_code = Column(String(64), nullable=True)
    
    suspended_by = Column(String(64), nullable=True)
    suspended_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    lifted_by = Column(String(64), nullable=True)
    lifted_at = Column(DateTime, nullable=True)
    lift_reason = Column(Text, nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    
    api_key = relationship("APIKey", back_populates="suspension_records")


class ManualReview(Base):
    __tablename__ = "manual_reviews"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), index=True, nullable=False)
    
    decision_log_id = Column(Integer, ForeignKey("decision_logs.id"), nullable=True)
    status = Column(SQLAlchemyEnum(ReviewStatus), default=ReviewStatus.PENDING, nullable=False)
    
    reason = Column(SQLAlchemyEnum(DecisionReason), nullable=False)
    details = Column(Text, nullable=True)
    
    requested_by = Column(String(64), nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    
    reviewed_by = Column(String(64), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    
    decision_result = Column(SQLAlchemyEnum(DecisionResult), nullable=True)
