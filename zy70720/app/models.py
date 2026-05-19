from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class IncidentStatus(str, enum.Enum):
    INVESTIGATING = "investigating"
    IDENTIFIED = "identified"
    MONITORING = "monitoring"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SubscriberStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    ACKNOWLEDGED = "acknowledged"


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    current_status = Column(Enum(IncidentStatus), default=IncidentStatus.INVESTIGATING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    review_summary = Column(Text)

    announcements = relationship("Announcement", back_populates="incident", order_by="Announcement.version")
    subscribers = relationship("Subscriber", back_populates="incident")
    confirmations = relationship("Confirmation", back_populates="incident")
    correction_logs = relationship("CorrectionLog", back_populates="incident")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"))
    version = Column(Integer, nullable=False)
    service_status = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    incident = relationship("Incident", back_populates="announcements")
    confirmations = relationship("Confirmation", back_populates="announcement")


class Subscriber(Base):
    __tablename__ = "subscribers"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"))
    name = Column(String, nullable=False)
    email = Column(String)
    status = Column(Enum(SubscriberStatus), default=SubscriberStatus.PENDING)
    subscribed_at = Column(DateTime(timezone=True), server_default=func.now())

    incident = relationship("Incident", back_populates="subscribers")
    confirmations = relationship("Confirmation", back_populates="subscriber")


class Confirmation(Base):
    __tablename__ = "confirmations"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"))
    announcement_id = Column(Integer, ForeignKey("announcements.id"))
    subscriber_id = Column(Integer, ForeignKey("subscribers.id"))
    confirmed_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text)

    incident = relationship("Incident", back_populates="confirmations")
    announcement = relationship("Announcement", back_populates="confirmations")
    subscriber = relationship("Subscriber", back_populates="confirmations")


class CorrectionLog(Base):
    __tablename__ = "correction_logs"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"))
    original_input = Column(Text, nullable=False)
    processed_by = Column(String, nullable=False)
    conclusion = Column(Text, nullable=False)
    correction_type = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    incident = relationship("Incident", back_populates="correction_logs")
