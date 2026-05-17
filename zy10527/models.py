from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Announcement(Base):
    __tablename__ = "announcements"
    
    id = Column(Integer, primary_key=True, index=True)
    announcement_no = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    
    versions = relationship("AnnouncementVersion", back_populates="announcement", order_by="AnnouncementVersion.version")
    confirmations = relationship("Confirmation", back_populates="announcement")
    withdrawals = relationship("Withdrawal", back_populates="announcement")

class AnnouncementVersion(Base):
    __tablename__ = "announcement_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id"))
    version = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, nullable=False)
    supplement = Column(Text, default="")
    supplement_by = Column(String, default="")
    supplement_at = Column(DateTime)
    
    announcement = relationship("Announcement", back_populates="versions")
    confirmations = relationship("Confirmation", back_populates="version")

class Confirmation(Base):
    __tablename__ = "confirmations"
    
    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id"))
    version_id = Column(Integer, ForeignKey("announcement_versions.id"))
    confirmer_id = Column(String, nullable=False)
    confirmer_name = Column(String, nullable=False)
    confirmed_at = Column(DateTime, default=datetime.utcnow)
    remark = Column(Text, default="")
    
    announcement = relationship("Announcement", back_populates="confirmations")
    version = relationship("AnnouncementVersion", back_populates="confirmations")

class Withdrawal(Base):
    __tablename__ = "withdrawals"
    
    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id"))
    version_id = Column(Integer, ForeignKey("announcement_versions.id"))
    withdrawn_by = Column(String, nullable=False)
    withdrawn_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text, nullable=False)
    
    announcement = relationship("Announcement", back_populates="withdrawals")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, nullable=False)
    original_input = Column(Text)
    processing_result = Column(Text)
    error_message = Column(Text)
    operator = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String)
    request_id = Column(String)
