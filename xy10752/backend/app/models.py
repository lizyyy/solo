from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_no = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    priority = Column(String(20), default="normal")
    status = Column(String(20), default="open")
    assignee = Column(String(100))
    creator = Column(String(100), nullable=False)
    sla_rule_id = Column(Integer, ForeignKey("sla_rules.id"))
    current_sla_status = Column(String(20), default="running")
    total_used_hours = Column(Float, default=0.0)
    remaining_hours = Column(Float, default=0.0)
    sla_deadline = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    resolved_at = Column(DateTime)
    closed_at = Column(DateTime)

    sla_rule = relationship("SLARule", back_populates="tickets")
    sla_timeline = relationship("SLATimeline", back_populates="ticket", cascade="all, delete-orphan")
    pause_records = relationship("PauseRecord", back_populates="ticket", cascade="all, delete-orphan")
    escalation_records = relationship("EscalationRecord", back_populates="ticket", cascade="all, delete-orphan")
    approval_records = relationship("ApprovalRecord", back_populates="ticket", cascade="all, delete-orphan")


class SLARule(Base):
    __tablename__ = "sla_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    priority = Column(String(20), nullable=False)
    response_hours = Column(Float, nullable=False)
    resolution_hours = Column(Float, nullable=False)
    work_start_hour = Column(Integer, default=9)
    work_end_hour = Column(Integer, default=18)
    work_days = Column(String(20), default="1,2,3,4,5")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    tickets = relationship("Ticket", back_populates="sla_rule")


class PauseReason(Base):
    __tablename__ = "pause_reasons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    category = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class PauseRecord(Base):
    __tablename__ = "pause_records"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    pause_reason_id = Column(Integer, ForeignKey("pause_reasons.id"))
    pause_reason_code = Column(String(50))
    pause_reason_name = Column(String(100))
    paused_by = Column(String(100), nullable=False)
    paused_at = Column(DateTime, server_default=func.now())
    resumed_at = Column(DateTime)
    pause_duration_hours = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    remarks = Column(Text)

    ticket = relationship("Ticket", back_populates="pause_records")
    pause_reason = relationship("PauseReason")


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(20), default="holiday")
    created_at = Column(DateTime, server_default=func.now())


class EscalationRecord(Base):
    __tablename__ = "escalation_records"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    escalation_type = Column(String(50), nullable=False)
    escalation_level = Column(Integer, default=1)
    escalated_by = Column(String(100))
    escalated_to = Column(String(100))
    escalated_at = Column(DateTime, server_default=func.now())
    reason = Column(Text)
    status = Column(String(20), default="pending")
    handled_at = Column(DateTime)
    handled_by = Column(String(100))
    remarks = Column(Text)

    ticket = relationship("Ticket", back_populates="escalation_records")


class ApprovalRecord(Base):
    __tablename__ = "approval_records"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    approval_type = Column(String(50), nullable=False)
    applicant = Column(String(100), nullable=False)
    approver = Column(String(100))
    status = Column(String(20), default="pending")
    requested_at = Column(DateTime, server_default=func.now())
    approved_at = Column(DateTime)
    rejected_at = Column(DateTime)
    reason = Column(Text)
    approval_remarks = Column(Text)

    ticket = relationship("Ticket", back_populates="approval_records")


class SLATimeline(Base):
    __tablename__ = "sla_timeline"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    event_title = Column(String(200), nullable=False)
    event_detail = Column(Text)
    operator = Column(String(100))
    happened_at = Column(DateTime, server_default=func.now())
    sla_impact_hours = Column(Float, default=0.0)
    remaining_before = Column(Float)
    remaining_after = Column(Float)

    ticket = relationship("Ticket", back_populates="sla_timeline")


class SLACompensation(Base):
    __tablename__ = "sla_compensations"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    compensation_type = Column(String(50), nullable=False)
    compensation_hours = Column(Float, nullable=False)
    reason = Column(Text)
    operator = Column(String(100), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    approved_by = Column(String(100))
    status = Column(String(20), default="applied")
