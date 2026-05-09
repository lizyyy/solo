from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class ChargingPile(Base):
    __tablename__ = "charging_piles"
    
    id = Column(Integer, primary_key=True, index=True)
    pile_code = Column(String(50), unique=True, index=True, nullable=False)
    station_name = Column(String(100), nullable=False)
    location = Column(String(200))
    power = Column(Integer, default=60)
    status = Column(String(20), default="AVAILABLE")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    faults = relationship("FaultEvent", back_populates="charging_pile")
    reservations = relationship("Reservation", back_populates="charging_pile")
    charging_sessions = relationship("ChargingSession", back_populates="charging_pile")


class FaultEvent(Base):
    __tablename__ = "fault_events"
    
    id = Column(Integer, primary_key=True, index=True)
    fault_code = Column(String(50), unique=True, index=True, nullable=False)
    pile_id = Column(Integer, ForeignKey("charging_piles.id"), nullable=False)
    fault_type = Column(String(50), nullable=False)
    fault_level = Column(String(20), default="MEDIUM")
    description = Column(Text)
    source = Column(String(50), default="AUTOMATIC")
    status = Column(String(20), default="OPEN")
    reported_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_at = Column(DateTime)
    resolved_at = Column(DateTime)
    sla_expires_at = Column(DateTime)
    
    charging_pile = relationship("ChargingPile", back_populates="faults")
    dispatches = relationship("DispatchOrder", back_populates="fault_event")
    recovery_report = relationship("RecoveryReport", uselist=False, back_populates="fault_event")


class Reservation(Base):
    __tablename__ = "reservations"
    
    id = Column(Integer, primary_key=True, index=True)
    reservation_code = Column(String(50), unique=True, index=True, nullable=False)
    pile_id = Column(Integer, ForeignKey("charging_piles.id"), nullable=False)
    user_id = Column(String(50), nullable=False)
    user_name = Column(String(100))
    phone = Column(String(20))
    reserved_start = Column(DateTime, nullable=False)
    reserved_end = Column(DateTime, nullable=False)
    status = Column(String(20), default="CONFIRMED")
    is_frozen = Column(Boolean, default=False)
    frozen_reason = Column(String(200))
    frozen_at = Column(DateTime)
    unfrozen_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    charging_pile = relationship("ChargingPile", back_populates="reservations")


class ChargingSession(Base):
    __tablename__ = "charging_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_code = Column(String(50), unique=True, index=True, nullable=False)
    pile_id = Column(Integer, ForeignKey("charging_piles.id"), nullable=False)
    user_id = Column(String(50), nullable=False)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime)
    start_kwh = Column(Float, default=0)
    end_kwh = Column(Float)
    charged_kwh = Column(Float)
    status = Column(String(20), default="CHARGING")
    is_truncated = Column(Boolean, default=False)
    truncation_reason = Column(String(200))
    truncated_at = Column(DateTime)
    total_amount = Column(Float)
    settlement_status = Column(String(20), default="UNSETTLED")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    charging_pile = relationship("ChargingPile", back_populates="charging_sessions")


class DispatchOrder(Base):
    __tablename__ = "dispatch_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String(50), unique=True, index=True, nullable=False)
    fault_event_id = Column(Integer, ForeignKey("fault_events.id"), nullable=False)
    engineer_id = Column(String(50), nullable=False)
    engineer_name = Column(String(100), nullable=False)
    engineer_phone = Column(String(20))
    priority = Column(String(20), default="NORMAL")
    status = Column(String(20), default="PENDING")
    dispatched_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime)
    arrived_at = Column(DateTime)
    completed_at = Column(DateTime)
    timeout_count = Column(Integer, default=0)
    reassigned_from = Column(Integer)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    fault_event = relationship("FaultEvent", back_populates="dispatches")


class SLARecord(Base):
    __tablename__ = "sla_records"
    
    id = Column(Integer, primary_key=True, index=True)
    fault_event_id = Column(Integer, ForeignKey("fault_events.id"), nullable=False)
    sla_type = Column(String(50), default="FIRST_RESPONSE")
    target_minutes = Column(Integer, default=30)
    actual_minutes = Column(Float)
    is_met = Column(Boolean)
    warning_sent = Column(Boolean, default=False)
    expired_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RecoveryReport(Base):
    __tablename__ = "recovery_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    fault_event_id = Column(Integer, ForeignKey("fault_events.id"), unique=True, nullable=False)
    report_code = Column(String(50), unique=True, index=True, nullable=False)
    root_cause = Column(Text, nullable=False)
    solution = Column(Text, nullable=False)
    preventive_measures = Column(Text)
    recovery_time_minutes = Column(Float)
    parts_replaced = Column(Text)
    verified_by = Column(String(100))
    verified_at = Column(DateTime)
    status = Column(String(20), default="DRAFT")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    fault_event = relationship("FaultEvent", back_populates="recovery_report")
