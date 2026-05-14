from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum
from sqlalchemy import Enum as SQLEnum


class TranslationStatus(str, enum.Enum):
    PENDING = "pending"
    MATCHED = "matched"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    MODIFIED = "modified"


class LanguageKey(Base):
    __tablename__ = "language_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    default_value = Column(Text, nullable=False)
    placeholder_pattern = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    translations = relationship("Translation", back_populates="language_key", cascade="all, delete-orphan")


class LanguagePack(Base):
    __tablename__ = "language_packs"

    id = Column(Integer, primary_key=True, index=True)
    language_code = Column(String(10), index=True, nullable=False)
    language_name = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    translations = relationship("Translation", back_populates="language_pack", cascade="all, delete-orphan")
    version_releases = relationship("VersionRelease", back_populates="language_pack")


class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, index=True)
    language_key_id = Column(Integer, ForeignKey("language_keys.id"), nullable=False)
    language_pack_id = Column(Integer, ForeignKey("language_packs.id"), nullable=False)
    translated_text = Column(Text, nullable=True)
    status = Column(SQLEnum(TranslationStatus), default=TranslationStatus.PENDING)
    placeholder_valid = Column(Boolean, default=True)
    placeholder_errors = Column(Text, nullable=True)
    is_missing = Column(Boolean, default=True)
    last_modified_by = Column(String(100), nullable=True)
    review_comment = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    language_key = relationship("LanguageKey", back_populates="translations")
    language_pack = relationship("LanguagePack", back_populates="translations")
    operation_logs = relationship("OperationLog", back_populates="translation")


class VersionRelease(Base):
    __tablename__ = "version_releases"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), index=True, nullable=False)
    language_pack_id = Column(Integer, ForeignKey("language_packs.id"), nullable=False)
    description = Column(Text, nullable=True)
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    published_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    language_pack = relationship("LanguagePack", back_populates="version_releases")
    coverage_report = relationship("CoverageReport", uselist=False, back_populates="version_release")


class CoverageReport(Base):
    __tablename__ = "coverage_reports"

    id = Column(Integer, primary_key=True, index=True)
    version_release_id = Column(Integer, ForeignKey("version_releases.id"), nullable=False)
    total_keys = Column(Integer, default=0)
    translated_keys = Column(Integer, default=0)
    missing_keys = Column(Integer, default=0)
    coverage_rate = Column(Float, default=0.0)
    placeholder_error_count = Column(Integer, default=0)
    report_data = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    version_release = relationship("VersionRelease", back_populates="coverage_report")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    translation_id = Column(Integer, ForeignKey("translations.id"), nullable=True)
    operation_type = Column(String(50), nullable=False)
    operator = Column(String(100), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    operation_time = Column(DateTime(timezone=True), server_default=func.now())
    request_idempotency_key = Column(String(100), index=True, nullable=True)

    translation = relationship("Translation", back_populates="operation_logs")
