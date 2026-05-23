from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ResearchGroup(Base):
    __tablename__ = "research_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    leader = Column(String(50), nullable=False)
    contact = Column(String(100))
    credit_score = Column(Float, default=100.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reservations = relationship("Reservation", back_populates="group")
    usage_reports = relationship("UsageReport", back_populates="group")


class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True, nullable=False)
    model = Column(String(100))
    location = Column(String(100))
    status = Column(String(20), default="available")
    hourly_rate = Column(Float, nullable=False)
    max_reservation_hours = Column(Integer, default=8)
    requires_risk_assessment = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reservations = relationship("Reservation", back_populates="instrument")
    usage_reports = relationship("UsageReport", back_populates="instrument")


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("research_groups.id"), nullable=False)
    user_name = Column(String(50), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="pending")
    sample_type = Column(String(100))
    purpose = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    instrument = relationship("Instrument", back_populates="reservations")
    group = relationship("ResearchGroup", back_populates="reservations")
    risk_assessment = relationship("SampleRisk", back_populates="reservation", uselist=False)
    cancellation = relationship("CancellationRecord", back_populates="reservation", uselist=False)
    usage_report = relationship("UsageReport", back_populates="reservation", uselist=False)


class SampleRisk(Base):
    __tablename__ = "sample_risks"

    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), unique=True, nullable=False)
    risk_level = Column(String(20), nullable=False)
    contamination_risk = Column(Boolean, default=False)
    biohazard_level = Column(Integer, default=0)
    special_requirements = Column(Text)
    approved = Column(Boolean, default=False)
    approved_by = Column(String(50))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reservation = relationship("Reservation", back_populates="risk_assessment")


class CancellationRecord(Base):
    __tablename__ = "cancellation_records"

    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), unique=True, nullable=False)
    cancelled_by = Column(String(50), nullable=False)
    reason = Column(Text)
    penalty_amount = Column(Float, default=0.0)
    penalty_applied = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reservation = relationship("Reservation", back_populates="cancellation")


class UsageReport(Base):
    __tablename__ = "usage_reports"

    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), unique=True, nullable=False)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("research_groups.id"), nullable=False)
    actual_start_time = Column(DateTime(timezone=True))
    actual_end_time = Column(DateTime(timezone=True))
    actual_duration_hours = Column(Float)
    exceeded_hours = Column(Float, default=0.0)
    overtime_penalty = Column(Float, default=0.0)
    total_cost = Column(Float)
    issues_found = Column(Text)
    sample_contamination = Column(Boolean, default=False)
    submitted_by = Column(String(50))
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

    reservation = relationship("Reservation", back_populates="usage_report")
    instrument = relationship("Instrument", back_populates="usage_reports")
    group = relationship("ResearchGroup", back_populates="usage_reports")


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String(200))
    raw_input = Column(Text)
    error_type = Column(String(100))
    error_message = Column(Text)
    handling_conclusion = Column(Text)
    handled_by = Column(String(50))
    handled_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved = Column(Boolean, default=False)
