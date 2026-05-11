from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base


class WristbandStatus(str, enum.Enum):
    ISSUED = "issued"
    FROZEN = "frozen"
    ACTIVE = "active"
    LOST = "lost"
    REPLACED = "replaced"
    SETTLED = "settled"


class DepositStatus(str, enum.Enum):
    FROZEN = "frozen"
    REFUNDED = "refunded"
    FORFEITED = "forfeited"
    USED = "used"


class SettlementStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"


class Wristband(Base):
    __tablename__ = "wristbands"

    id = Column(Integer, primary_key=True, index=True)
    wristband_no = Column(String(50), unique=True, index=True, nullable=False)
    visitor_name = Column(String(100))
    status = Column(SQLEnum(WristbandStatus), default=WristbandStatus.ISSUED)
    deposit_amount = Column(Float, default=20.0)
    balance = Column(Float, default=0.0)
    issued_at = Column(DateTime, default=datetime.utcnow)
    original_wristband_id = Column(Integer, ForeignKey("wristbands.id"), nullable=True)
    
    deposits = relationship("Deposit", back_populates="wristband", foreign_keys="Deposit.wristband_id")
    transactions = relationship("Transaction", back_populates="wristband")
    replacements = relationship("Wristband", remote_side=[id], backref="original_wristband")


class Deposit(Base):
    __tablename__ = "deposits"

    id = Column(Integer, primary_key=True, index=True)
    wristband_id = Column(Integer, ForeignKey("wristbands.id"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(SQLEnum(DepositStatus), default=DepositStatus.FROZEN)
    frozen_at = Column(DateTime, default=datetime.utcnow)
    unfrozen_at = Column(DateTime, nullable=True)
    settlement_id = Column(Integer, ForeignKey("settlements.id"), nullable=True)
    
    wristband = relationship("Wristband", back_populates="deposits")
    settlement = relationship("Settlement", back_populates="deposits")


class TransactionType(str, enum.Enum):
    DEPOSIT = "deposit"
    CONSUMPTION = "consumption"
    REFUND = "refund"
    REPLACEMENT_FEE = "replacement_fee"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    wristband_id = Column(Integer, ForeignKey("wristbands.id"), nullable=False)
    transaction_type = Column(SQLEnum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String(255))
    balance_after = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    settlement_id = Column(Integer, ForeignKey("settlements.id"), nullable=True)
    
    wristband = relationship("Wristband", back_populates="transactions")
    settlement = relationship("Settlement", back_populates="transactions")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, index=True)
    settlement_date = Column(DateTime, default=datetime.utcnow)
    status = Column(SQLEnum(SettlementStatus), default=SettlementStatus.PENDING)
    total_deposit_frozen = Column(Float, default=0.0)
    total_deposit_refunded = Column(Float, default=0.0)
    total_deposit_forfeited = Column(Float, default=0.0)
    total_consumption = Column(Float, default=0.0)
    total_replacement_fees = Column(Float, default=0.0)
    export_file_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    deposits = relationship("Deposit", back_populates="settlement")
    transactions = relationship("Transaction", back_populates="settlement")
