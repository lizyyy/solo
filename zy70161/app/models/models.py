from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from ..database import Base
import enum


class RuleType(str, enum.Enum):
    BLACKLIST = "blacklist"
    WHITELIST = "whitelist"


class RuleStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    REVIEW_REJECTED = "review_rejected"
    PENDING_GRAY = "pending_gray"
    IN_GRAY = "in_gray"
    GRAY_REJECTED = "gray_rejected"
    PRODUCTION = "production"
    ROLLED_BACK = "rolled_back"
    DEPRECATED = "deprecated"


class ReviewStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class GrayEffectStatus(str, enum.Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"


class TermLibrary(Base):
    __tablename__ = "term_libraries"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    versions = relationship("TermLibraryVersion", back_populates="library")
    rules = relationship("TermRule", back_populates="library")


class TermLibraryVersion(Base):
    __tablename__ = "term_library_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    library_id = Column(Integer, ForeignKey("term_libraries.id"), nullable=False)
    version = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    is_current = Column(Boolean, default=False)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    deployed_at = Column(DateTime, nullable=True)
    
    library = relationship("TermLibrary", back_populates="versions")
    rules = relationship("TermRule", back_populates="version")
    gray_releases = relationship("GrayRelease", back_populates="version")


class TermRule(Base):
    __tablename__ = "term_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    library_id = Column(Integer, ForeignKey("term_libraries.id"), nullable=False)
    version_id = Column(Integer, ForeignKey("term_library_versions.id"), nullable=True)
    rule_type = Column(Enum(RuleType), nullable=False)
    term = Column(String(200), nullable=False)
    match_type = Column(String(20), default="exact")
    priority = Column(Integer, default=0)
    action = Column(String(50), default="filter")
    reason = Column(Text, nullable=True)
    status = Column(Enum(RuleStatus), default=RuleStatus.DRAFT)
    current_review_id = Column(Integer, ForeignKey("review_requests.id"), nullable=True)
    current_gray_id = Column(Integer, ForeignKey("gray_releases.id"), nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    library = relationship("TermLibrary", back_populates="rules")
    version = relationship("TermLibraryVersion", back_populates="rules")
    reviews = relationship("ReviewRequest", back_populates="rule", foreign_keys="ReviewRequest.rule_id")
    gray_releases = relationship("GrayRelease", back_populates="rule", foreign_keys="GrayRelease.rule_id")
    audit_logs = relationship("AuditLog", back_populates="rule")


class ReviewRequest(Base):
    __tablename__ = "review_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("term_rules.id"), nullable=False)
    status = Column(Enum(ReviewStatus), default=ReviewStatus.PENDING)
    requested_by = Column(String(50), nullable=False)
    reviewer = Column(String(50), nullable=True)
    comments = Column(Text, nullable=True)
    review_comment = Column(Text, nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    
    rule = relationship("TermRule", back_populates="reviews", foreign_keys=[rule_id])


class GrayRelease(Base):
    __tablename__ = "gray_releases"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("term_rules.id"), nullable=False)
    version_id = Column(Integer, ForeignKey("term_library_versions.id"), nullable=True)
    traffic_percentage = Column(Float, default=10.0)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=False)
    effect_status = Column(Enum(GrayEffectStatus), default=GrayEffectStatus.PENDING)
    effect_comment = Column(Text, nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    stopped_at = Column(DateTime, nullable=True)
    stopped_by = Column(String(50), nullable=True)
    
    rule = relationship("TermRule", back_populates="gray_releases", foreign_keys=[rule_id])
    version = relationship("TermLibraryVersion", back_populates="gray_releases")
    effect_checks = relationship("GrayEffectCheck", back_populates="gray_release")


class GrayEffectCheck(Base):
    __tablename__ = "gray_effect_checks"
    
    id = Column(Integer, primary_key=True, index=True)
    gray_release_id = Column(Integer, ForeignKey("gray_releases.id"), nullable=False)
    check_type = Column(String(50), nullable=False)
    search_term = Column(String(200), nullable=True)
    expected_result = Column(Text, nullable=True)
    actual_result = Column(Text, nullable=True)
    passed = Column(Boolean, nullable=True)
    checked_by = Column(String(50), nullable=False)
    checked_at = Column(DateTime, default=datetime.utcnow)
    comments = Column(Text, nullable=True)
    
    gray_release = relationship("GrayRelease", back_populates="effect_checks")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("term_rules.id"), nullable=False)
    action = Column(String(50), nullable=False)
    from_status = Column(Enum(RuleStatus), nullable=True)
    to_status = Column(Enum(RuleStatus), nullable=True)
    actor = Column(String(50), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text, nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    
    rule = relationship("TermRule", back_populates="audit_logs")


class ExportRecord(Base):
    __tablename__ = "export_records"
    
    id = Column(Integer, primary_key=True, index=True)
    export_type = Column(String(50), nullable=False)
    export_params = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=True)
    file_name = Column(String(200), nullable=True)
    record_count = Column(Integer, default=0)
    status = Column(String(20), default="pending")
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
