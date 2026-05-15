from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ExportStatus(str, enum.Enum):
    PENDING = "pending"
    VALIDATING = "validating"
    APPROVED = "approved"
    GENERATING = "generating"
    READY = "ready"
    DOWNLOADED = "downloaded"
    EXPIRED = "expired"
    REJECTED = "rejected"
    FAILED = "failed"


class ExportRequest(Base):
    __tablename__ = "export_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    requester_id = Column(String, index=True, nullable=False)
    requester_name = Column(String, nullable=False)
    data_source = Column(String, nullable=False)
    field_scope = Column(JSON, nullable=False)
    watermark_id = Column(String, index=True)
    watermark_content = Column(JSON)
    download_signature = Column(String)
    expiry_policy = Column(JSON, nullable=False)
    expiry_time = Column(DateTime)
    status = Column(String, default=ExportStatus.PENDING)
    current_handler = Column(String)
    final_conclusion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    audit_logs = relationship("AuditLog", back_populates="export_request")
    watermark = relationship("Watermark", back_populates="export_request", uselist=False)


class Watermark(Base):
    __tablename__ = "watermarks"

    id = Column(Integer, primary_key=True, index=True)
    watermark_id = Column(String, unique=True, index=True, nullable=False)
    export_request_id = Column(Integer, ForeignKey("export_requests.id"))
    watermark_type = Column(String, nullable=False)
    content = Column(JSON, nullable=False)
    generated_by = Column(String, nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    export_request = relationship("ExportRequest", back_populates="watermark")


class FieldAuthorization(Base):
    __tablename__ = "field_authorizations"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(String, index=True, nullable=False)
    data_source = Column(String, nullable=False)
    field_name = Column(String, nullable=False)
    is_authorized = Column(Boolean, default=False)
    authorized_by = Column(String)
    authorized_at = Column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    export_request_id = Column(Integer, ForeignKey("export_requests.id"))
    action = Column(String, nullable=False)
    old_status = Column(String)
    new_status = Column(String)
    operator_id = Column(String, nullable=False)
    operator_name = Column(String, nullable=False)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    export_request = relationship("ExportRequest", back_populates="audit_logs")


class IdempotentRequest(Base):
    __tablename__ = "idempotent_requests"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    request_hash = Column(String, nullable=False)
    response_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
