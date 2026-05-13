from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class TicketStatus(str, enum.Enum):
    PENDING = "pending"
    MATCHING = "matching"
    MERGED = "merged"
    ANALYZING = "analyzing"
    ROOT_CAUSE_LABELLED = "root_cause_labelled"
    DISPATCHED = "dispatched"
    COMPLETED = "completed"
    FAILED = "failed"


class ErrorEvent(Base):
    __tablename__ = "error_events"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    ticket_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    error_code = Column(String, index=True)
    error_message = Column(Text)
    api_path = Column(String, index=True)
    stack_trace = Column(Text)
    severity = Column(String, default="medium")
    status = Column(Enum(TicketStatus), default=TicketStatus.PENDING)
    extra_data = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    root_cause = relationship("RootCauseLabel", back_populates="ticket", uselist=False)
    dispatch_records = relationship("DispatchRecord", back_populates="ticket")
    similar_tickets = relationship(
        "SimilarTicket",
        foreign_keys="SimilarTicket.ticket_id",
        back_populates="ticket"
    )
    attribution_rules = relationship("AttributionRuleMatch", back_populates="ticket")


class AttributionRule(Base):
    __tablename__ = "attribution_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    error_code_pattern = Column(String)
    api_path_pattern = Column(String)
    keyword_pattern = Column(String)
    root_cause_tag = Column(String)
    assignee = Column(String)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    matches = relationship("AttributionRuleMatch", back_populates="rule")


class AttributionRuleMatch(Base):
    __tablename__ = "attribution_rule_matches"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("error_events.id"))
    rule_id = Column(Integer, ForeignKey("attribution_rules.id"))
    match_score = Column(Integer, default=0)
    matched_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("ErrorEvent", back_populates="attribution_rules")
    rule = relationship("AttributionRule", back_populates="matches")


class SimilarTicket(Base):
    __tablename__ = "similar_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("error_events.id"))
    similar_ticket_id = Column(Integer, ForeignKey("error_events.id"))
    similarity_score = Column(Integer, default=0)
    merged = Column(Boolean, default=False)
    merged_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("ErrorEvent", foreign_keys=[ticket_id])
    similar_ticket = relationship("ErrorEvent", foreign_keys=[similar_ticket_id])


class RootCauseLabel(Base):
    __tablename__ = "root_cause_labels"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("error_events.id"), unique=True)
    root_cause_category = Column(String, nullable=False)
    root_cause_detail = Column(Text)
    confidence_score = Column(Integer, default=0)
    tagged_by = Column(String)
    tagged_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("ErrorEvent", back_populates="root_cause")


class DispatchRecord(Base):
    __tablename__ = "dispatch_records"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("error_events.id"))
    assignee = Column(String, nullable=False)
    dispatch_note = Column(Text)
    status = Column(String, default="pending")
    dispatched_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True))

    ticket = relationship("ErrorEvent", back_populates="dispatch_records")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("error_events.id"))
    from_status = Column(String)
    to_status = Column(String, nullable=False)
    reason = Column(Text)
    changed_by = Column(String)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())