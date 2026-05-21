from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base

class DocumentStatus(str, enum.Enum):
    CREATED = "created"
    SCANNING = "scanning"
    SCAN_COMPLETED = "scan_completed"
    PENDING_REVIEW = "pending_review"
    REVIEWING = "reviewing"
    REVIEW_COMPLETED = "review_completed"
    GENERATING_VERSION = "generating_version"
    VERSION_GENERATED = "version_generated"
    PENDING_AUTHORIZATION = "pending_authorization"
    AUTHORIZED = "authorized"
    EXPORTING = "exporting"
    EXPORTED = "exported"
    ERROR = "error"

class MaskingRuleType(str, enum.Enum):
    NAME = "name"
    ID_CARD = "id_card"
    PHONE = "phone"
    EMAIL = "email"
    ADDRESS = "address"

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500))
    file_size = Column(Integer)
    content = Column(Text)
    masked_content = Column(Text)
    status = Column(String(50), default=DocumentStatus.CREATED)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    error_message = Column(Text)
    
    hits = relationship("SensitiveHit", back_populates="document", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="document", cascade="all, delete-orphan")
    versions = relationship("ExportVersion", back_populates="document", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="document", cascade="all, delete-orphan")

class MaskingRule(Base):
    __tablename__ = "masking_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False)
    pattern = Column(String(500))
    replacement = Column(String(100), default="***")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class SensitiveHit(Base):
    __tablename__ = "sensitive_hits"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    rule_id = Column(Integer, ForeignKey("masking_rules.id"))
    matched_text = Column(String(500))
    line_number = Column(Integer)
    column_number = Column(Integer)
    context = Column(String(1000))
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    document = relationship("Document", back_populates="hits")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    reviewer = Column(String(100))
    comment = Column(Text)
    decision = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    document = relationship("Document", back_populates="reviews")

class ExportVersion(Base):
    __tablename__ = "export_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    version_number = Column(String(50))
    file_path = Column(String(500))
    report_path = Column(String(500))
    is_authorized = Column(Boolean, default=False)
    authorized_by = Column(String(100))
    authorized_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    document = relationship("Document", back_populates="versions")
    download_records = relationship("DownloadRecord", back_populates="version", cascade="all, delete-orphan")

class DownloadRecord(Base):
    __tablename__ = "download_records"
    
    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("export_versions.id"))
    downloaded_by = Column(String(100))
    downloaded_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(50))
    
    version = relationship("ExportVersion", back_populates="download_records")

class StatusHistory(Base):
    __tablename__ = "status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    from_status = Column(String(50))
    to_status = Column(String(50))
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    document = relationship("Document", back_populates="status_history")
