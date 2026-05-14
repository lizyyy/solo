from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class UploadTask(Base):
    __tablename__ = "upload_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True)
    filename = Column(String)
    original_filename = Column(String)
    file_size = Column(Integer)
    file_type = Column(String)
    file_path = Column(String)
    file_hash_md5 = Column(String)
    file_hash_sha256 = Column(String)
    status = Column(String, default="pending")
    isolation_status = Column(String, default="none")
    scan_engine = Column(String)
    scan_result = Column(String)
    threat_level = Column(String, default="safe")
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    uploaded_by = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    scanned_at = Column(DateTime)
    processed_at = Column(DateTime)
    raw_input = Column(Text)
    processed_result = Column(Text)
    notes = Column(Text)

    security_logs = relationship("SecurityLog", back_populates="upload_task")
    organization = relationship("Organization", back_populates="upload_tasks")


class SecurityLog(Base):
    __tablename__ = "security_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String, unique=True, index=True)
    upload_task_id = Column(Integer, ForeignKey("upload_tasks.id"))
    event_type = Column(String)
    severity = Column(String)
    message = Column(Text)
    source_ip = Column(String)
    user_agent = Column(String)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String)
    resolved_at = Column(DateTime)

    upload_task = relationship("UploadTask", back_populates="security_logs")


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    code = Column(String, unique=True, index=True)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    upload_tasks = relationship("UploadTask", back_populates="organization")


class ScanRule(Base):
    __tablename__ = "scan_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    rule_type = Column(String)
    pattern = Column(String)
    description = Column(Text)
    severity = Column(String, default="medium")
    is_active = Column(Boolean, default=True)
    action = Column(String, default="isolate")
    created_at = Column(DateTime, default=datetime.utcnow)
