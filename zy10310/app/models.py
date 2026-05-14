from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import uuid
import time


def generate_uuid():
    try:
        import uuid7
        return str(uuid7.uuid7())
    except ImportError:
        timestamp = int(time.time() * 1000000)
        return f"{timestamp:012x}-{str(uuid.uuid4())[12:]}"


class ImportPackage(Base):
    __tablename__ = "import_packages"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    tenant_id = Column(String, index=True, nullable=False)
    package_name = Column(String, nullable=False)
    package_version = Column(String, nullable=False)
    status = Column(String, index=True, nullable=False, default="CREATED")
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    rules_version = Column(String, nullable=False)
    source_hash = Column(String, index=True, nullable=False)
    metadata_ = Column(JSON, name="metadata", default={})

    field_mappings = relationship("FieldMapping", back_populates="import_package", cascade="all, delete-orphan")
    dependency_resources = relationship("DependencyResource", back_populates="import_package", cascade="all, delete-orphan")
    precheck_errors = relationship("PrecheckError", back_populates="import_package", cascade="all, delete-orphan")
    pass_certificates = relationship("PassCertificate", back_populates="import_package", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="import_package", cascade="all, delete-orphan")


class FieldMapping(Base):
    __tablename__ = "field_mappings"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    package_id = Column(String, ForeignKey("import_packages.id"), nullable=False)
    source_field = Column(String, nullable=False)
    target_field = Column(String, nullable=False)
    mapping_type = Column(String, nullable=False)
    transform_rule = Column(JSON, default={})
    is_valid = Column(Boolean, default=True)
    validation_message = Column(Text, nullable=True)

    import_package = relationship("ImportPackage", back_populates="field_mappings")


class DependencyResource(Base):
    __tablename__ = "dependency_resources"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    package_id = Column(String, ForeignKey("import_packages.id"), nullable=False)
    resource_type = Column(String, nullable=False)
    resource_name = Column(String, nullable=False)
    resource_id = Column(String, nullable=True)
    status = Column(String, nullable=False, default="PENDING")
    required = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)

    import_package = relationship("ImportPackage", back_populates="dependency_resources")


class PrecheckError(Base):
    __tablename__ = "precheck_errors"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    package_id = Column(String, ForeignKey("import_packages.id"), nullable=False)
    error_code = Column(String, nullable=False)
    error_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    field = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    detail = Column(JSON, default={})
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, nullable=True)

    import_package = relationship("ImportPackage", back_populates="precheck_errors")
    fix_suggestions = relationship("FixSuggestion", back_populates="precheck_error", cascade="all, delete-orphan")


class FixSuggestion(Base):
    __tablename__ = "fix_suggestions"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    error_id = Column(String, ForeignKey("precheck_errors.id"), nullable=False)
    suggestion_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    operation_steps = Column(JSON, default=[])
    auto_fixable = Column(Boolean, default=False)

    precheck_error = relationship("PrecheckError", back_populates="fix_suggestions")


class PassCertificate(Base):
    __tablename__ = "pass_certificates"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    package_id = Column(String, ForeignKey("import_packages.id"), nullable=False)
    certificate_number = Column(String, unique=True, nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    issued_by = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    rules_version = Column(String, nullable=False)
    checksum = Column(String, nullable=False)
    is_revoked = Column(Boolean, default=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by = Column(String, nullable=True)

    import_package = relationship("ImportPackage", back_populates="pass_certificates")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    package_id = Column(String, ForeignKey("import_packages.id"), nullable=False)
    action = Column(String, nullable=False)
    old_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    operator = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    details = Column(JSON, default={})
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)

    import_package = relationship("ImportPackage", back_populates="audit_logs")
