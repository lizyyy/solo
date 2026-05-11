from datetime import datetime, timedelta
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, Date
)
from sqlalchemy.orm import relationship
from database import Base


class Merchant(Base):
    __tablename__ = "merchants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    contact = Column(String(50), nullable=True)
    type = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class Resource(Base):
    __tablename__ = "resources"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    location = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FaultRecord(Base):
    __tablename__ = "fault_records"
    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    fault_time = Column(DateTime, nullable=False)
    fault_type = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    reported_by = Column(String(50), nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_time = Column(DateTime, nullable=True)
    resolution_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resource = relationship("Resource")


class Reservation(Base):
    __tablename__ = "reservations"
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    purpose = Column(Text, nullable=True)
    status = Column(String(20), default="confirmed")
    conflict_note = Column(Text, nullable=True)
    has_conflict = Column(Boolean, default=False)
    original_reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    merchant = relationship("Merchant")
    resource = relationship("Resource")
    original_reservation = relationship("Reservation", remote_side=[id])


class CleaningWindow(Base):
    __tablename__ = "cleaning_windows"
    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    minimum_cleaning_minutes = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.utcnow)
    resource = relationship("Resource")


class OvertimeRecord(Base):
    __tablename__ = "overtime_records"
    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=False)
    actual_end_time = Column(DateTime, nullable=False)
    overtime_minutes = Column(Integer, nullable=False)
    hourly_rate = Column(Float, default=50.0)
    overtime_fee = Column(Float, nullable=False)
    affected_next_reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)
    status = Column(String(20), default="pending")
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reservation = relationship("Reservation", foreign_keys=[reservation_id])
    affected_reservation = relationship("Reservation", foreign_keys=[affected_next_reservation_id])


class MerchantFee(Base):
    __tablename__ = "merchant_fees"
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    date = Column(Date, nullable=False)
    reservation_fee = Column(Float, default=0.0)
    overtime_fee = Column(Float, default=0.0)
    total_fee = Column(Float, default=0.0)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    merchant = relationship("Merchant")
