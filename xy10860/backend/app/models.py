import enum
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.types import Enum as SQLAlchemyEnum

from .database import Base


class ReleaseStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    ROLLED_BACK = "rolled_back"
    TIMEOUT = "timeout"


class EnvironmentType(str, enum.Enum):
    DEV = "dev"
    TEST = "test"
    STAGING = "staging"
    PROD = "prod"


class CheckItemStatus(str, enum.Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ReleaseOrder(Base):
    __tablename__ = "release_orders"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    version = Column(String(50))
    environment = Column(SQLAlchemyEnum(EnvironmentType), nullable=False)
    status = Column(SQLAlchemyEnum(ReleaseStatus), default=ReleaseStatus.DRAFT)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    scheduled_at = Column(DateTime)
    timeout_hours = Column(Integer, default=24)
    deployed_at = Column(DateTime)

    approvals = relationship("Approval", back_populates="release_order", cascade="all, delete-orphan")
    check_items = relationship("CheckItem", back_populates="release_order", cascade="all, delete-orphan")
    tokens = relationship("ReleaseToken", back_populates="release_order", cascade="all, delete-orphan")
    rollback_records = relationship("RollbackRecord", back_populates="release_order", cascade="all, delete-orphan")
    timeline = relationship("TimelineEvent", back_populates="release_order", cascade="all, delete-orphan")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    release_order_id = Column(Integer, ForeignKey("release_orders.id"))
    approver = Column(String(100), nullable=False)
    approved = Column(Boolean)
    comment = Column(Text)
    approved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    release_order = relationship("ReleaseOrder", back_populates="approvals")


class CheckItem(Base):
    __tablename__ = "check_items"

    id = Column(Integer, primary_key=True, index=True)
    release_order_id = Column(Integer, ForeignKey("release_orders.id"))
    name = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(SQLAlchemyEnum(CheckItemStatus), default=CheckItemStatus.PENDING)
    checked_by = Column(String(100))
    checked_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    release_order = relationship("ReleaseOrder", back_populates="check_items")


class ReleaseToken(Base):
    __tablename__ = "release_tokens"

    id = Column(Integer, primary_key=True, index=True)
    release_order_id = Column(Integer, ForeignKey("release_orders.id"))
    token = Column(String(100), unique=True, nullable=False)
    issued_by = Column(String(100), nullable=False)
    issued_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    used_at = Column(DateTime)

    release_order = relationship("ReleaseOrder", back_populates="tokens")

    @property
    def is_valid(self):
        return not self.used and datetime.utcnow() < self.expires_at


class RollbackRecord(Base):
    __tablename__ = "rollback_records"

    id = Column(Integer, primary_key=True, index=True)
    release_order_id = Column(Integer, ForeignKey("release_orders.id"))
    reason = Column(Text, nullable=False)
    rolled_back_by = Column(String(100), nullable=False)
    rolled_back_at = Column(DateTime, default=datetime.utcnow)
    previous_version = Column(String(50))

    release_order = relationship("ReleaseOrder", back_populates="rollback_records")


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    release_order_id = Column(Integer, ForeignKey("release_orders.id"))
    event_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    release_order = relationship("ReleaseOrder", back_populates="timeline")
