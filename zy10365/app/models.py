from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class VerificationStatus(str, enum.Enum):
    PENDING = "pending"
    REPLAYING = "replaying"
    DIFFING = "diffing"
    PENDING_CONFIRM = "pending_confirm"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    RELEASED = "released"
    FAILED = "failed"


class DiffLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class GrayVersion(Base):
    __tablename__ = "gray_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text)
    target_url = Column(String(500), nullable=False)
    base_url = Column(String(500), nullable=False)
    created_by = Column(String(100), nullable=False)
    status = Column(String(50), default=VerificationStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    requests = relationship("HistoryRequest", back_populates="gray_version")
    timelines = relationship("Timeline", back_populates="gray_version")
    conclusions = relationship("ReleaseConclusion", back_populates="gray_version")


class HistoryRequest(Base):
    __tablename__ = "history_requests"

    id = Column(Integer, primary_key=True, index=True)
    gray_version_id = Column(Integer, ForeignKey("gray_versions.id"), nullable=False)
    request_id = Column(String(100), index=True, nullable=False)
    method = Column(String(20), nullable=False)
    path = Column(String(500), nullable=False)
    headers = Column(JSON)
    query_params = Column(JSON)
    request_body = Column(JSON)
    base_response = Column(JSON)
    base_status_code = Column(Integer)
    base_response_time = Column(Float)
    gray_response = Column(JSON)
    gray_status_code = Column(Integer)
    gray_response_time = Column(Float)
    replayed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    gray_version = relationship("GrayVersion", back_populates="requests")
    diffs = relationship("ResponseDiff", back_populates="request")
    timelines = relationship("Timeline", back_populates="request")


class ResponseDiff(Base):
    __tablename__ = "response_diffs"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("history_requests.id"), nullable=False)
    diff_path = Column(String(500), nullable=False)
    diff_type = Column(String(100), nullable=False)
    base_value = Column(Text)
    gray_value = Column(Text)
    level = Column(String(50), default=DiffLevel.WARNING)
    is_tolerated = Column(Boolean, default=False)
    tolerance_rule_id = Column(Integer, ForeignKey("tolerance_rules.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("HistoryRequest", back_populates="diffs")
    tolerance_rule = relationship("ToleranceRule")


class ToleranceRule(Base):
    __tablename__ = "tolerance_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    path_pattern = Column(String(500), nullable=False)
    diff_type = Column(String(100))
    tolerance_type = Column(String(50), nullable=False)
    tolerance_value = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Confirmer(Base):
    __tablename__ = "confirmers"

    id = Column(Integer, primary_key=True, index=True)
    gray_version_id = Column(Integer, ForeignKey("gray_versions.id"), nullable=False)
    user_id = Column(String(100), nullable=False)
    user_name = Column(String(200), nullable=False)
    role = Column(String(100))
    confirmed = Column(Boolean, default=False)
    confirmed_at = Column(DateTime(timezone=True))
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ReleaseConclusion(Base):
    __tablename__ = "release_conclusions"

    id = Column(Integer, primary_key=True, index=True)
    gray_version_id = Column(Integer, ForeignKey("gray_versions.id"), nullable=False)
    conclusion_type = Column(String(50), nullable=False)
    summary = Column(Text, nullable=False)
    total_requests = Column(Integer, default=0)
    success_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    total_diffs = Column(Integer, default=0)
    critical_diffs = Column(Integer, default=0)
    error_diffs = Column(Integer, default=0)
    warning_diffs = Column(Integer, default=0)
    tolerated_diffs = Column(Integer, default=0)
    released_by = Column(String(100))
    released_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    gray_version = relationship("GrayVersion", back_populates="conclusions")


class Timeline(Base):
    __tablename__ = "timelines"

    id = Column(Integer, primary_key=True, index=True)
    gray_version_id = Column(Integer, ForeignKey("gray_versions.id"))
    request_id = Column(Integer, ForeignKey("history_requests.id"))
    action = Column(String(200), nullable=False)
    actor = Column(String(100))
    details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    gray_version = relationship("GrayVersion", back_populates="timelines")
    request = relationship("HistoryRequest", back_populates="timelines")
