import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.types import Enum

from app.database import Base


class FaultType(str, enum.Enum):
    DOOR_FAIL = "door_fail"
    SCAN_FAIL = "scan_fail"
    EMPTY_BIN_FALSE = "empty_bin_false"
    OTHER = "other"


class TicketStatus(str, enum.Enum):
    PENDING = "pending"
    RECEIVED = "received"
    ATTRIBUTED = "attributed"
    DISPATCHED = "dispatched"
    REPAIRED = "repaired"
    REVIEWED = "reviewed"
    CLOSED = "closed"
    REJECTED = "rejected"


class DispatchStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ReviewResult(str, enum.Enum):
    PASSED = "passed"
    FAILED = "failed"
    NEED_REPAIR = "need_repair"


class RuleAction(str, enum.Enum):
    ALLOW = "allow"
    BLOCK = "block"
    MERGE = "merge"


class Cabinet(Base):
    __tablename__ = "cabinets"

    id = Column(Integer, primary_key=True, index=True)
    cabinet_code = Column(String, unique=True, index=True, nullable=False)
    location = Column(String)
    is_online = Column(Boolean, default=True)
    last_online_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tickets = relationship("Ticket", back_populates="cabinet")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_no = Column(String, unique=True, index=True, nullable=False)
    cabinet_id = Column(Integer, ForeignKey("cabinets.id"))
    cabinet_code = Column(String, index=True)
    fault_type = Column(Enum(FaultType))
    fault_description = Column(Text)
    bin_number = Column(String)
    customer_phone = Column(String)
    customer_name = Column(String)
    source = Column(String)
    status = Column(Enum(TicketStatus), default=TicketStatus.PENDING)
    attributed_reason = Column(String)
    attributed_by = Column(String)
    attributed_at = Column(DateTime)
    reviewed_result = Column(Enum(ReviewResult))
    reviewed_comment = Column(Text)
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime)
    rule_applied = Column(String)
    rule_action = Column(Enum(RuleAction))
    rule_reason = Column(Text)
    merged_to_ticket_id = Column(Integer, ForeignKey("tickets.id"))
    import_batch_no = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cabinet = relationship("Cabinet", back_populates="tickets")
    dispatches = relationship("Dispatch", back_populates="ticket")
    merged_tickets = relationship("Ticket", remote_side=[id])
    ticket_logs = relationship("TicketLog", back_populates="ticket")


class Dispatch(Base):
    __tablename__ = "dispatches"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_no = Column(String, unique=True, index=True, nullable=False)
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    technician_id = Column(String)
    technician_name = Column(String)
    status = Column(Enum(DispatchStatus), default=DispatchStatus.PENDING)
    scheduled_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    repair_description = Column(Text)
    before_status = Column(String)
    after_status = Column(String)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="dispatches")


class TicketLog(Base):
    __tablename__ = "ticket_logs"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"))
    action = Column(String)
    old_status = Column(String)
    new_status = Column(String)
    operator = Column(String)
    reason = Column(Text)
    extra_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    ticket = relationship("Ticket", back_populates="ticket_logs")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    file_name = Column(String)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    fail_details = Column(Text)
    imported_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
