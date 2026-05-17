from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class ReservationStatus(str, enum.Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class WaitlistStatus(str, enum.Enum):
    WAITING = "waiting"
    NOTIFIED = "notified"
    CONFIRMED = "confirmed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class NotificationChannel(str, enum.Enum):
    WECHAT = "wechat"
    SMS = "sms"
    EMAIL = "email"
    IN_APP = "in_app"


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    resource_code = Column(String, unique=True, index=True, nullable=False)
    resource_name = Column(String, nullable=False)
    resource_type = Column(String)
    capacity = Column(Integer, default=1)
    location = Column(String)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    reservations = relationship("Reservation", back_populates="resource")
    waitlists = relationship("Waitlist", back_populates="resource")


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    reservation_no = Column(String, unique=True, index=True, nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    booker_id = Column(String, index=True, nullable=False)
    booker_name = Column(String, nullable=False)
    booker_contact = Column(String)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(ReservationStatus), default=ReservationStatus.CONFIRMED)
    cancel_reason = Column(Text)
    cancelled_at = Column(DateTime(timezone=True))
    cancel_operator = Column(String)
    raw_request = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    resource = relationship("Resource", back_populates="reservations")
    waitlist_notifications = relationship("WaitlistNotification", back_populates="reservation")


class Waitlist(Base):
    __tablename__ = "waitlists"

    id = Column(Integer, primary_key=True, index=True)
    waitlist_no = Column(String, unique=True, index=True, nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    user_id = Column(String, index=True, nullable=False)
    user_name = Column(String, nullable=False)
    user_contact = Column(String)
    priority = Column(Integer, default=0)
    desired_start_time = Column(DateTime(timezone=True))
    desired_end_time = Column(DateTime(timezone=True))
    status = Column(Enum(WaitlistStatus), default=WaitlistStatus.WAITING)
    queue_position = Column(Integer)
    notified_at = Column(DateTime(timezone=True))
    confirmed_at = Column(DateTime(timezone=True))
    expired_at = Column(DateTime(timezone=True))
    confirm_deadline = Column(DateTime(timezone=True))
    raw_request = Column(Text)
    processing_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    resource = relationship("Resource", back_populates="waitlists")
    notifications = relationship("WaitlistNotification", back_populates="waitlist")


class WaitlistNotification(Base):
    __tablename__ = "waitlist_notifications"

    id = Column(Integer, primary_key=True, index=True)
    waitlist_id = Column(Integer, ForeignKey("waitlists.id"), nullable=False)
    reservation_id = Column(Integer, ForeignKey("reservations.id"))
    notification_channel = Column(Enum(NotificationChannel))
    notification_content = Column(Text)
    sent_at = Column(DateTime(timezone=True))
    delivered = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True))
    receipt_confirmed = Column(Boolean, default=False)
    receipt_at = Column(DateTime(timezone=True))
    retry_count = Column(Integer, default=0)
    deduplication_key = Column(String, index=True)
    raw_payload = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    waitlist = relationship("Waitlist", back_populates="notifications")
    reservation = relationship("Reservation", back_populates="waitlist_notifications")


class WaitlistReport(Base):
    __tablename__ = "waitlist_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String, unique=True, index=True, nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"))
    report_type = Column(String)
    period_start = Column(DateTime(timezone=True))
    period_end = Column(DateTime(timezone=True))
    total_waitlist_count = Column(Integer, default=0)
    notified_count = Column(Integer, default=0)
    confirmed_count = Column(Integer, default=0)
    expired_count = Column(Integer, default=0)
    cancelled_count = Column(Integer, default=0)
    avg_wait_time_minutes = Column(Integer)
    cancellation_reasons = Column(Text)
    report_content = Column(Text)
    generated_by = Column(String)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, index=True)
    target_type = Column(String)
    target_id = Column(Integer)
    operator = Column(String)
    original_data = Column(Text)
    new_data = Column(Text)
    reason = Column(Text)
    ip_address = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
