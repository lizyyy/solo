import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class FaultStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    IN_PROGRESS = "in_progress"
    RESOLVING = "resolving"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"

class ImpactLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class FaultEvent(Base):
    __tablename__ = "fault_events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum(FaultStatus), default=FaultStatus.DRAFT)
    impact_level = Column(Enum(ImpactLevel), default=ImpactLevel.MEDIUM)
    created_by = Column(String(128), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    interfaces = relationship("ImpactedInterface", back_populates="event", cascade="all, delete-orphan")
    customers = relationship("CustomerScope", back_populates="event", cascade="all, delete-orphan")
    versions = relationship("DeclarationVersion", back_populates="event", cascade="all, delete-orphan")
    updates = relationship("UpdateRecord", back_populates="event", cascade="all, delete-orphan")
    notifications = relationship("ResolutionNotification", back_populates="event", cascade="all, delete-orphan")

class ImpactedInterface(Base):
    __tablename__ = "impacted_interfaces"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("fault_events.id"), nullable=False)
    api_path = Column(String(512), nullable=False)
    api_method = Column(String(16), nullable=False)
    service_name = Column(String(128), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    event = relationship("FaultEvent", back_populates="interfaces")

class CustomerScope(Base):
    __tablename__ = "customer_scopes"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("fault_events.id"), nullable=False)
    customer_id = Column(String(64), nullable=False)
    customer_name = Column(String(255), nullable=False)
    contact_email = Column(String(255))
    contact_phone = Column(String(64))
    is_notified = Column(Boolean, default=False)
    notified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    event = relationship("FaultEvent", back_populates="customers")

class DeclarationVersion(Base):
    __tablename__ = "declaration_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("fault_events.id"), nullable=False)
    version = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    impact_level = Column(Enum(ImpactLevel))
    created_by = Column(String(128), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    change_log = Column(Text)
    
    event = relationship("FaultEvent", back_populates="versions")

class UpdateRecord(Base):
    __tablename__ = "update_records"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("fault_events.id"), nullable=False)
    update_type = Column(String(64), nullable=False)
    content = Column(Text, nullable=False)
    created_by = Column(String(128), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    event = relationship("FaultEvent", back_populates="updates")

class ResolutionNotification(Base):
    __tablename__ = "resolution_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("fault_events.id"), nullable=False)
    customer_id = Column(String(64), nullable=False)
    notification_content = Column(Text, nullable=False)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    confirmed = Column(Boolean, default=False)
    confirmed_at = Column(DateTime(timezone=True))
    confirmed_by = Column(String(128))
    
    event = relationship("FaultEvent", back_populates="notifications")

class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(128), unique=True, index=True, nullable=False)
    request_hash = Column(String(256), nullable=False)
    response_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
