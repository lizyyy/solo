import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship
from database import Base


class ExportRequestStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_LEGAL = "pending_legal"
    LEGAL_APPROVED = "legal_approved"
    PENDING_PACKAGE = "pending_package"
    PACKAGING = "packaging"
    PACKAGED = "packaged"
    DELIVERED = "delivered"
    REJECTED = "rejected"
    NEEDS_REVIEW = "needs_review"


class ApprovalNodeType(str, enum.Enum):
    LEGAL = "legal"
    DATA_PROTECTION = "data_protection"
    MANAGER = "manager"


class UserSubject(Base):
    __tablename__ = "user_subjects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    consent_versions = relationship("ConsentVersion", back_populates="user_subject")
    export_requests = relationship("ExportRequest", back_populates="user_subject")


class ConsentVersion(Base):
    __tablename__ = "consent_versions"

    id = Column(Integer, primary_key=True, index=True)
    user_subject_id = Column(Integer, ForeignKey("user_subjects.id"), nullable=False)
    version = Column(String, nullable=False)
    consent_type = Column(String, nullable=False)
    agreed_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user_subject = relationship("UserSubject", back_populates="consent_versions")


class ExportScope(Base):
    __tablename__ = "export_scopes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    data_categories = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExportRequest(Base):
    __tablename__ = "export_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    user_subject_id = Column(Integer, ForeignKey("user_subjects.id"), nullable=False)
    consent_version_id = Column(Integer, ForeignKey("consent_versions.id"), nullable=False)
    status = Column(Enum(ExportRequestStatus), default=ExportRequestStatus.DRAFT)
    requested_at = Column(DateTime, default=datetime.utcnow)
    requester_notes = Column(Text)
    legal_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user_subject = relationship("UserSubject", back_populates="export_requests")
    consent_version = relationship("ConsentVersion")
    scopes = relationship("ExportRequestScope", back_populates="export_request", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="export_request", cascade="all, delete-orphan")
    package_task = relationship("PackageTask", back_populates="export_request", uselist=False)
    delivery_record = relationship("DeliveryRecord", back_populates="export_request", uselist=False)


class ExportRequestScope(Base):
    __tablename__ = "export_request_scopes"

    id = Column(Integer, primary_key=True, index=True)
    export_request_id = Column(Integer, ForeignKey("export_requests.id"), nullable=False)
    export_scope_id = Column(Integer, ForeignKey("export_scopes.id"), nullable=False)

    export_request = relationship("ExportRequest", back_populates="scopes")
    export_scope = relationship("ExportScope")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    export_request_id = Column(Integer, ForeignKey("export_requests.id"), nullable=False)
    node_type = Column(Enum(ApprovalNodeType), nullable=False)
    approver_name = Column(String)
    approver_email = Column(String)
    approved = Column(Boolean)
    approved_at = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    export_request = relationship("ExportRequest", back_populates="approvals")


class PackageTask(Base):
    __tablename__ = "package_tasks"

    id = Column(Integer, primary_key=True, index=True)
    export_request_id = Column(Integer, ForeignKey("export_requests.id"), nullable=False)
    task_id = Column(String, unique=True, nullable=False)
    status = Column(String, default="pending")
    package_url = Column(String)
    package_checksum = Column(String)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    export_request = relationship("ExportRequest", back_populates="package_task")


class DeliveryRecord(Base):
    __tablename__ = "delivery_records"

    id = Column(Integer, primary_key=True, index=True)
    export_request_id = Column(Integer, ForeignKey("export_requests.id"), nullable=False)
    delivered_at = Column(DateTime, default=datetime.utcnow)
    delivered_to = Column(String, nullable=False)
    delivery_method = Column(String, nullable=False)
    tracking_number = Column(String)
    confirmed_receipt = Column(Boolean, default=False)
    confirmed_at = Column(DateTime)
    notes = Column(Text)

    export_request = relationship("ExportRequest", back_populates="delivery_record")
