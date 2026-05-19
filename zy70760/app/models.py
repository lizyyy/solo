from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()


class WheelStatus(str, enum.Enum):
    PENDING = "pending"
    PARSING = "parsing"
    VALIDATING = "validating"
    PASSED = "passed"
    FAILED = "failed"
    MANUAL_REVIEW = "manual_review"
    CLOSED = "closed"
    WITHDRAWN = "withdrawn"


class WheelFile(Base):
    __tablename__ = "wheel_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), index=True)
    file_hash = Column(String(64), index=True)
    file_size = Column(Integer)
    upload_time = Column(DateTime, default=datetime.utcnow)
    uploader = Column(String(100))
    status = Column(String(50), default=WheelStatus.PENDING.value)
    platform_tag = Column(String(100))
    python_version = Column(String(50))
    package_name = Column(String(255))
    package_version = Column(String(100))
    original_filename = Column(String(255))

    metadata = relationship("MetaData", back_populates="wheel_file", uselist=False)
    entry_points = relationship("EntryPoint", back_populates="wheel_file")
    dependencies = relationship("Dependency", back_populates="wheel_file")
    validation_reports = relationship("ValidationReport", back_populates="wheel_file")
    exception_paths = relationship("ExceptionPath", back_populates="wheel_file")
    audit_logs = relationship("AuditLog", back_populates="wheel_file")


class MetaData(Base):
    __tablename__ = "metadata"

    id = Column(Integer, primary_key=True, index=True)
    wheel_file_id = Column(Integer, ForeignKey("wheel_files.id"))
    metadata_version = Column(String(50))
    name = Column(String(255))
    version = Column(String(100))
    summary = Column(Text)
    description = Column(Text)
    description_content_type = Column(String(100))
    keywords = Column(String(255))
    home_page = Column(String(500))
    author = Column(String(255))
    author_email = Column(String(255))
    license = Column(String(255))
    classifier = Column(Text)
    requires_python = Column(String(100))
    raw_metadata = Column(Text)

    wheel_file = relationship("WheelFile", back_populates="metadata")


class EntryPoint(Base):
    __tablename__ = "entry_points"

    id = Column(Integer, primary_key=True, index=True)
    wheel_file_id = Column(Integer, ForeignKey("wheel_files.id"))
    group = Column(String(255), index=True)
    name = Column(String(255))
    module = Column(String(255))
    attr = Column(String(255))
    extras = Column(String(255))
    is_valid = Column(Boolean, default=True)
    validation_error = Column(Text)

    wheel_file = relationship("WheelFile", back_populates="entry_points")


class Dependency(Base):
    __tablename__ = "dependencies"

    id = Column(Integer, primary_key=True, index=True)
    wheel_file_id = Column(Integer, ForeignKey("wheel_files.id"))
    name = Column(String(255), index=True)
    specifier = Column(String(255))
    extras = Column(String(255))
    environment_marker = Column(String(255))
    is_valid = Column(Boolean, default=True)
    validation_error = Column(Text)

    wheel_file = relationship("WheelFile", back_populates="dependencies")


class ValidationReport(Base):
    __tablename__ = "validation_reports"

    id = Column(Integer, primary_key=True, index=True)
    wheel_file_id = Column(Integer, ForeignKey("wheel_files.id"))
    report_type = Column(String(100))
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String(100))
    overall_status = Column(String(50))
    platform_tag_check = Column(Boolean)
    platform_tag_message = Column(Text)
    entry_points_check = Column(Boolean)
    entry_points_message = Column(Text)
    dependencies_check = Column(Boolean)
    dependencies_message = Column(Text)
    metadata_check = Column(Boolean)
    metadata_message = Column(Text)
    raw_report = Column(Text)

    wheel_file = relationship("WheelFile", back_populates="validation_reports")


class ExceptionPath(Base):
    __tablename__ = "exception_paths"

    id = Column(Integer, primary_key=True, index=True)
    wheel_file_id = Column(Integer, ForeignKey("wheel_files.id"))
    original_input = Column(Text)
    handler = Column(String(100))
    conclusion = Column(Text)
    handled_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text)

    wheel_file = relationship("WheelFile", back_populates="exception_paths")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    wheel_file_id = Column(Integer, ForeignKey("wheel_files.id"))
    action = Column(String(100))
    old_status = Column(String(50))
    new_status = Column(String(50))
    actor = Column(String(100))
    timestamp = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text)

    wheel_file = relationship("WheelFile", back_populates="audit_logs")
