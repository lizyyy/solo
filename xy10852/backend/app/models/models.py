from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class ChannelType(str, enum.Enum):
    SMS = "sms"
    EMAIL = "email"
    IN_APP = "in_app"


class SourceType(str, enum.Enum):
    USER_PROFILE = "user_profile"
    ADMIN_PANEL = "admin_panel"
    BATCH_IMPORT = "batch_import"
    API = "api"
    MARKETING_CAMPAIGN = "marketing_campaign"


class PreferenceStatus(str, enum.Enum):
    ACTIVE = "active"
    PENDING = "pending"
    CONFLICT = "conflict"
    ERROR = "error"
    MERGED = "merged"


class BusinessScene(str, enum.Enum):
    TRANSACTIONAL = "transactional"
    MARKETING = "marketing"
    SECURITY = "security"
    SYSTEM = "system"


class InterceptionStatus(str, enum.Enum):
    PENDING = "pending"
    ALLOWED = "allowed"
    BLOCKED = "blocked"
    REVIEWED = "reviewed"


class SourcePriority(int, enum.Enum):
    USER_PROFILE = 100
    ADMIN_PANEL = 80
    API = 60
    MARKETING_CAMPAIGN = 40
    BATCH_IMPORT = 20


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), index=True, nullable=False)
    channel = Column(Enum(ChannelType), nullable=False)
    business_scene = Column(Enum(BusinessScene), nullable=False)
    enabled = Column(Boolean, default=True)
    source = Column(Enum(SourceType), nullable=False)
    source_priority = Column(Integer, nullable=False)
    status = Column(Enum(PreferenceStatus), default=PreferenceStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    metadata = Column(JSON, default=dict)

    change_histories = relationship("ChangeHistory", back_populates="preference")
    interceptions = relationship("SendInterception", back_populates="preference")


class ChangeHistory(Base):
    __tablename__ = "change_histories"

    id = Column(Integer, primary_key=True, index=True)
    preference_id = Column(Integer, ForeignKey("user_preferences.id"))
    user_id = Column(String(50), index=True)
    channel = Column(Enum(ChannelType))
    business_scene = Column(Enum(BusinessScene))
    old_value = Column(JSON)
    new_value = Column(JSON)
    source = Column(Enum(SourceType))
    operator = Column(String(100))
    change_type = Column(String(50))
    snapshot = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    preference = relationship("UserPreference", back_populates="change_histories")


class SendInterception(Base):
    __tablename__ = "send_interceptions"

    id = Column(Integer, primary_key=True, index=True)
    preference_id = Column(Integer, ForeignKey("user_preferences.id"))
    user_id = Column(String(50), index=True)
    channel = Column(Enum(ChannelType))
    business_scene = Column(Enum(BusinessScene))
    status = Column(Enum(InterceptionStatus), default=InterceptionStatus.PENDING)
    reason = Column(Text)
    interception_rule = Column(String(200))
    message_id = Column(String(100))
    checked_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    preference = relationship("UserPreference", back_populates="interceptions")


class AnomalyQueue(Base):
    __tablename__ = "anomaly_queues"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), index=True)
    channel = Column(Enum(ChannelType))
    business_scene = Column(Enum(BusinessScene))
    anomaly_type = Column(String(100))
    description = Column(Text)
    source = Column(Enum(SourceType))
    status = Column(String(50), default="pending")
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    last_retry_at = Column(DateTime(timezone=True))
    resolved_at = Column(DateTime(timezone=True))
    resolver = Column(String(100))
    resolution_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    metadata = Column(JSON, default=dict)
