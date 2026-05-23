import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base

class SeatStatus(str, enum.Enum):
    AVAILABLE = "available"
    LOCKED = "locked"
    RESERVED = "reserved"
    SOLD = "sold"

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    MODIFIED = "modified"
    COMPLETED = "completed"

class ChangeStatus(str, enum.Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPENSATED = "compensated"
    CANCELLED = "cancelled"

class ReserveWindowStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    RELEASED = "released"
    CONVERTED = "converted"

class ExceptionType(str, enum.Enum):
    DUPLICATE_LOCK = "duplicate_lock"
    SEAT_NOT_AVAILABLE = "seat_not_available"
    INVALID_CHANGE = "invalid_change"
    WINDOW_EXPIRED = "window_expired"
    INSUFFICIENT_SEATS = "insufficient_seats"
    MANUAL_CORRECTION = "manual_correction"

class Show(Base):
    __tablename__ = "shows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    venue = Column(String(200), nullable=False)
    show_time = Column(DateTime, nullable=False)
    total_seats = Column(Integer, nullable=False)
    available_seats = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    seats = relationship("Seat", back_populates="show")
    orders = relationship("GroupOrder", back_populates="show")

class Seat(Base):
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    show_id = Column(Integer, ForeignKey("shows.id"), nullable=False)
    row = Column(String(10), nullable=False)
    number = Column(String(10), nullable=False)
    section = Column(String(50))
    price = Column(Float, nullable=False)
    status = Column(String(50), default=SeatStatus.AVAILABLE)
    locked_by_order_id = Column(Integer, ForeignKey("group_orders.id"))
    locked_at = Column(DateTime)

    show = relationship("Show", back_populates="seats")
    lock_order = relationship("GroupOrder", foreign_keys=[locked_by_order_id])

class GroupOrder(Base):
    __tablename__ = "group_orders"

    id = Column(Integer, primary_key=True, index=True)
    show_id = Column(Integer, ForeignKey("shows.id"), nullable=False)
    contact_name = Column(String(100), nullable=False)
    contact_phone = Column(String(20), nullable=False)
    group_name = Column(String(200))
    requested_seats_count = Column(Integer, nullable=False)
    actual_seats_count = Column(Integer)
    status = Column(String(50), default=OrderStatus.PENDING)
    total_amount = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    show = relationship("Show", back_populates="orders")
    reserve_windows = relationship("ReserveWindow", back_populates="order")
    change_requests = relationship("SeatChangeRequest", foreign_keys="SeatChangeRequest.order_id", back_populates="order")

class ReserveWindow(Base):
    __tablename__ = "reserve_windows"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("group_orders.id"), nullable=False)
    show_id = Column(Integer, ForeignKey("shows.id"), nullable=False)
    seat_ids = Column(JSON, nullable=False)
    expire_at = Column(DateTime, nullable=False)
    status = Column(String(50), default=ReserveWindowStatus.ACTIVE)
    created_at = Column(DateTime, server_default=func.now())
    released_at = Column(DateTime)
    released_reason = Column(String(500))

    order = relationship("GroupOrder", back_populates="reserve_windows")

class SeatChangeRequest(Base):
    __tablename__ = "seat_change_requests"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("group_orders.id"), nullable=False)
    show_id = Column(Integer, ForeignKey("shows.id"), nullable=False)
    original_seat_ids = Column(JSON, nullable=False)
    requested_seat_ids = Column(JSON, nullable=False)
    new_seat_count = Column(Integer, nullable=False)
    reason = Column(Text)
    status = Column(String(50), default=ChangeStatus.PENDING_REVIEW)
    review_notes = Column(Text)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    compensation_amount = Column(Float, default=0)
    created_at = Column(DateTime, server_default=func.now())

    order = relationship("GroupOrder", back_populates="change_requests")

class LockReport(Base):
    __tablename__ = "lock_reports"

    id = Column(Integer, primary_key=True, index=True)
    show_id = Column(Integer, ForeignKey("shows.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("group_orders.id"))
    report_type = Column(String(50), nullable=False)
    seat_ids = Column(JSON)
    seat_count = Column(Integer)
    details = Column(JSON)
    generated_at = Column(DateTime, server_default=func.now())
    generated_by = Column(String(100))

class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    exception_type = Column(String(100), nullable=False)
    endpoint = Column(String(200))
    original_input = Column(JSON, nullable=False)
    error_message = Column(Text)
    resolution = Column(String(500))
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())