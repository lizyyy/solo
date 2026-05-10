from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class ConfigVersion(Base):
    __tablename__ = "config_versions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    config_key = Column(String(100), nullable=False, index=True)
    version = Column(String(50), nullable=False)
    content = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )

class GrayscaleRule(Base):
    __tablename__ = "grayscale_rules"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    config_version_id = Column(Integer, ForeignKey('config_versions.id'), nullable=False)
    idc_list = Column(JSON, nullable=True)
    tenant_list = Column(JSON, nullable=True)
    percentage = Column(Float, default=0, nullable=False)
    match_mode = Column(String(20), default='any', nullable=False)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(20), default='draft', nullable=False)
    
    config_version = relationship("ConfigVersion")

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_id = Column(Integer, ForeignKey('grayscale_rules.id'), nullable=False)
    title = Column(String(200), nullable=False)
    applicant = Column(String(100), nullable=False)
    approver = Column(String(100), nullable=False)
    status = Column(String(20), default='pending', nullable=False)
    comment = Column(Text, nullable=True)
    approval_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    rollback_reason = Column(Text, nullable=True)
    rollback_at = Column(DateTime, nullable=True)
    
    rule = relationship("GrayscaleRule")

class InstanceAck(Base):
    __tablename__ = "instance_acks"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_id = Column(Integer, ForeignKey('grayscale_rules.id'), nullable=False)
    instance_id = Column(String(100), nullable=False, index=True)
    idc = Column(String(50), nullable=True)
    tenant = Column(String(100), nullable=True)
    status = Column(String(20), default='pending', nullable=False)
    ack_content = Column(JSON, nullable=True)
    ack_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    rule = relationship("GrayscaleRule")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_id = Column(Integer, ForeignKey('grayscale_rules.id'), nullable=True)
    approval_id = Column(Integer, ForeignKey('approval_requests.id'), nullable=True)
    action = Column(String(50), nullable=False)
    operator = Column(String(100), nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    rule = relationship("GrayscaleRule")
    approval = relationship("ApprovalRequest")

class ResourceLock(Base):
    __tablename__ = "resource_locks"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_key = Column(String(100), unique=True, nullable=False, index=True)
    lock_token = Column(String(100), nullable=False)
    acquired_by = Column(String(100), nullable=False)
    acquired_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
