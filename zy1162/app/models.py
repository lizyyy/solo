from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class RedPacketStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_PAYMENT = "pending_payment"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FROZEN = "frozen"


class PacketStatus(str, enum.Enum):
    PENDING = "pending"
    LOCKED = "locked"
    CLAIMED = "claimed"
    EXPIRED = "expired"
    FROZEN = "frozen"


class TransactionType(str, enum.Enum):
    RECHARGE = "recharge"
    CREATE_PACKET = "create_packet"
    CLAIM_PACKET = "claim_packet"
    REFUND = "refund"
    FROZEN = "frozen"
    UNFROZEN = "unfrozen"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RiskAction(str, enum.Enum):
    FREEZE = "freeze"
    UNFREEZE = "unfreeze"
    WARN = "warn"


class RedPacketActivity(Base):
    __tablename__ = "red_packet_activities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    activity_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    total_amount = Column(Float, nullable=False)
    total_count = Column(Integer, nullable=False)
    remaining_amount = Column(Float, default=0.0)
    remaining_count = Column(Integer, default=0)
    
    status = Column(String(20), default=RedPacketStatus.DRAFT.value, nullable=False)
    rule_type = Column(String(20), default="random", nullable=False)
    
    merchant_id = Column(String(50), index=True, nullable=False)
    merchant_name = Column(String(200), nullable=True)
    
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    packets = relationship("RedPacket", back_populates="activity")
    payments = relationship("Payment", back_populates="activity")
    transactions = relationship("LedgerTransaction", back_populates="activity")
    risk_records = relationship("RiskRecord", back_populates="activity")


class RedPacket(Base):
    __tablename__ = "red_packets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    packet_id = Column(String(50), unique=True, index=True, nullable=False)
    activity_id = Column(String(50), ForeignKey("red_packet_activities.activity_id"), index=True, nullable=False)
    
    amount = Column(Float, nullable=False)
    status = Column(String(20), default=PacketStatus.PENDING.value, nullable=False)
    
    receiver_id = Column(String(50), nullable=True)
    receiver_name = Column(String(200), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    
    lock_expire_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    activity = relationship("RedPacketActivity", back_populates="packets")
    claim_requests = relationship("ClaimRequest", back_populates="packet")


class ClaimRequest(Base):
    __tablename__ = "claim_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(100), unique=True, index=True, nullable=False)
    packet_id = Column(String(50), ForeignKey("red_packets.packet_id"), index=True, nullable=False)
    
    user_id = Column(String(50), index=True, nullable=False)
    user_name = Column(String(200), nullable=True)
    
    status = Column(String(20), default="pending", nullable=False)
    is_success = Column(Boolean, default=False, nullable=False)
    error_message = Column(Text, nullable=True)
    
    claimed_amount = Column(Float, nullable=True)
    
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    packet = relationship("RedPacket", back_populates="claim_requests")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_id = Column(String(50), unique=True, index=True, nullable=False)
    activity_id = Column(String(50), ForeignKey("red_packet_activities.activity_id"), index=True, nullable=False)
    
    amount = Column(Float, nullable=False)
    status = Column(String(20), default=PaymentStatus.PENDING.value, nullable=False)
    
    merchant_id = Column(String(50), index=True, nullable=False)
    payment_method = Column(String(50), default="mock", nullable=False)
    external_order_id = Column(String(100), nullable=True)
    
    callback_received = Column(Boolean, default=False, nullable=False)
    callback_data = Column(Text, nullable=True)
    callback_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    activity = relationship("RedPacketActivity", back_populates="payments")


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(50), unique=True, index=True, nullable=False)
    
    activity_id = Column(String(50), ForeignKey("red_packet_activities.activity_id"), nullable=True)
    packet_id = Column(String(50), ForeignKey("red_packets.packet_id"), nullable=True)
    payment_id = Column(String(50), ForeignKey("payments.payment_id"), nullable=True)
    
    transaction_type = Column(String(30), nullable=False)
    merchant_id = Column(String(50), index=True, nullable=False)
    user_id = Column(String(50), nullable=True)
    
    amount = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=True)
    
    description = Column(String(500), nullable=True)
    reference_id = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    activity = relationship("RedPacketActivity", back_populates="transactions")


class RiskRecord(Base):
    __tablename__ = "risk_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(String(50), unique=True, index=True, nullable=False)
    
    activity_id = Column(String(50), ForeignKey("red_packet_activities.activity_id"), nullable=True)
    packet_id = Column(String(50), ForeignKey("red_packets.packet_id"), nullable=True)
    
    merchant_id = Column(String(50), index=True, nullable=False)
    user_id = Column(String(50), nullable=True)
    
    risk_type = Column(String(50), nullable=False)
    risk_level = Column(String(20), default="medium", nullable=False)
    action = Column(String(30), nullable=False)
    
    reason = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolver_id = Column(String(50), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    activity = relationship("RedPacketActivity", back_populates="risk_records")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    log_id = Column(String(50), unique=True, index=True, nullable=False)
    
    action = Column(String(100), nullable=False)
    module = Column(String(50), nullable=False)
    
    user_id = Column(String(50), nullable=True)
    merchant_id = Column(String(50), index=True, nullable=True)
    
    activity_id = Column(String(50), nullable=True)
    packet_id = Column(String(50), nullable=True)
    transaction_id = Column(String(50), nullable=True)
    payment_id = Column(String(50), nullable=True)
    
    request_id = Column(String(100), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
