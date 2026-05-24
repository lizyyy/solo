import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class CompensationStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFYING = "verifying"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPENSATED = "compensated"
    CANCELLED = "cancelled"
    CLOSED = "closed"


class FaultCategory(str, enum.Enum):
    PAYMENT_NO_ELECTRICITY = "payment_no_electricity"
    HARDWARE_FAULT = "hardware_fault"
    NETWORK_FAULT = "network_fault"
    OVERCHARGE = "overcharge"
    UNDERCHARGE = "undercharge"
    OTHER = "other"


class ConclusionType(str, enum.Enum):
    PILE_FAULT = "pile_fault"
    USER_OPERATION = "user_operation"
    NETWORK_ISSUE = "network_issue"
    SYSTEM_ERROR = "system_error"
    NO_FAULT = "no_fault"
    OTHER = "other"


class ChargingPile(Base):
    __tablename__ = "charging_piles"

    id = Column(Integer, primary_key=True, index=True)
    pile_no = Column(String, unique=True, index=True, nullable=False)
    location = Column(String)
    model = Column(String)
    status = Column(String, default="normal")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    compensation_records = relationship("CompensationRecord", back_populates="pile")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True)
    pile_no = Column(String, index=True)
    amount = Column(Float, default=0)
    pay_time = Column(DateTime)
    pay_status = Column(String, default="unpaid")
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    raw_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    compensation_records = relationship("CompensationRecord", back_populates="order")


class ElectricityRecord(Base):
    __tablename__ = "electricity_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String, unique=True, index=True, nullable=False)
    order_no = Column(String, index=True)
    pile_no = Column(String, index=True)
    start_energy = Column(Float, default=0)
    end_energy = Column(Float, default=0)
    total_energy = Column(Float, default=0)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    raw_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    compensation_records = relationship("CompensationRecord", back_populates="electricity")


class FaultCode(Base):
    __tablename__ = "fault_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String)
    category = Column(String)
    description = Column(Text)
    severity = Column(String, default="normal")
    created_at = Column(DateTime, default=datetime.utcnow)


class CompensationVoucher(Base):
    __tablename__ = "compensation_vouchers"

    id = Column(Integer, primary_key=True, index=True)
    voucher_no = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, index=True)
    amount = Column(Float, default=0)
    valid_from = Column(DateTime)
    valid_to = Column(DateTime)
    status = Column(String, default="unused")
    used_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    compensation_records = relationship("CompensationRecord", back_populates="voucher")


class CompensationRecord(Base):
    __tablename__ = "compensation_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, index=True)
    case_no = Column(String, unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"))
    electricity_id = Column(Integer, ForeignKey("electricity_records.id"))
    pile_id = Column(Integer, ForeignKey("charging_piles.id"))
    voucher_id = Column(Integer, ForeignKey("compensation_vouchers.id"))

    user_id = Column(String, index=True)
    pile_no = Column(String, index=True)
    order_no = Column(String, index=True)
    fault_code = Column(String)
    fault_category = Column(String)
    description = Column(Text)
    raw_input = Column(Text)

    status = Column(String, default=CompensationStatus.PENDING)
    conclusion = Column(String)
    suggestion = Column(Text)
    compensation_amount = Column(Float, default=0)
    is_duplicate = Column(Boolean, default=False)

    operator = Column(String)
    verified_at = Column(DateTime)
    confirmed_at = Column(DateTime)
    closed_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", back_populates="compensation_records")
    electricity = relationship("ElectricityRecord", back_populates="compensation_records")
    pile = relationship("ChargingPile", back_populates="compensation_records")
    voucher = relationship("CompensationVoucher", back_populates="compensation_records")
    operation_logs = relationship("OperationLog", back_populates="compensation_record")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    compensation_record_id = Column(Integer, ForeignKey("compensation_records.id"))
    operation = Column(String)
    old_status = Column(String)
    new_status = Column(String)
    operator = Column(String)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    compensation_record = relationship("CompensationRecord", back_populates="operation_logs")
