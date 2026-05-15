import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class TicketStatus(str, enum.Enum):
    PENDING = "pending"
    SCANNING = "scanning"
    REVIEW_REQUIRED = "review_required"
    APPROVED = "approved"
    REJECTED = "rejected"
    ROLLBACK_PENDING = "rollback_pending"
    ROLLED_BACK = "rolled_back"
    CLEANED = "cleaned"


class ScanStatus(str, enum.Enum):
    PASS = "pass"
    FAIL = "fail"
    SUSPICIOUS = "suspicious"
    CONFLICT = "conflict"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_no = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    applicant = Column(String, nullable=False)
    application_type = Column(String, nullable=False)
    description = Column(Text)
    status = Column(Enum(TicketStatus), default=TicketStatus.PENDING)
    current_version = Column(Integer, default=1)
    has_version_conflict = Column(Boolean, default=False)
    summary = Column(Text)
    conclusion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")
    scan_records = relationship("ScanRecord", back_populates="ticket", cascade="all, delete-orphan")
    status_logs = relationship("StatusLog", back_populates="ticket", cascade="all, delete-orphan")
    manual_notes = relationship("ManualNote", back_populates="ticket", cascade="all, delete-orphan")


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_type = Column(String)
    file_size = Column(Integer)
    file_hash = Column(String)
    version = Column(Integer, default=1)
    uploaded_by = Column(String)
    content_preview = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="attachments")


class ScanRecord(Base):
    __tablename__ = "scan_records"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    attachment_id = Column(Integer, ForeignKey("ticket_attachments.id"))
    scan_type = Column(String, nullable=False)
    status = Column(Enum(ScanStatus), nullable=False)
    version = Column(Integer)
    scan_result = Column(Text)
    risk_level = Column(String)
    scanner = Column(String)
    scanned_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="scan_records")


class StatusLog(Base):
    __tablename__ = "status_logs"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    from_status = Column(Enum(TicketStatus))
    to_status = Column(Enum(TicketStatus), nullable=False)
    operator = Column(String, nullable=False)
    reason = Column(Text)
    duty_record = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="status_logs")


class ManualNote(Base):
    __tablename__ = "manual_notes"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    original_conclusion = Column(Text)
    revised_conclusion = Column(Text)
    operator = Column(String, nullable=False)
    remark = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="manual_notes")
