from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, JSON
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_no = Column(String(64), unique=True, nullable=False, index=True)
    source_type = Column(String(32), nullable=False)  # add_item_csv / package_json / unit_contract
    source_name = Column(String(256), nullable=True)
    created_by = Column(String(64), nullable=False)
    status = Column(String(32), nullable=False, default="pending")  # pending / processed / returned
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    remark = Column(Text, nullable=True)

    records = relationship("Record", back_populates="batch", cascade="all, delete-orphan")
    logs = relationship("AuditLog", back_populates="batch", cascade="all, delete-orphan")


class Record(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    record_no = Column(String(64), unique=True, nullable=False, index=True)
    patient_name = Column(String(64), nullable=True)
    patient_id = Column(String(64), nullable=True, index=True)
    unit_name = Column(String(128), nullable=True, index=True)
    package_name = Column(String(128), nullable=True)
    contract_id = Column(String(64), nullable=True, index=True)
    item_code = Column(String(64), nullable=True)
    item_name = Column(String(128), nullable=True)
    item_type = Column(String(32), nullable=True)  # 加项 / 套餐内项 / 退项
    unit_price = Column(Float, nullable=True)
    quantity = Column(Integer, nullable=True)
    total_amount = Column(Float, nullable=True)
    voucher_code = Column(String(64), nullable=True)
    coupon_stack = Column(Boolean, default=False)
    refund_flag = Column(Boolean, default=False)
    refund_amount = Column(Float, nullable=True)
    unit_limit_applied = Column(Boolean, default=False)
    unit_limit_amount = Column(Float, nullable=True)
    status = Column(String(32), nullable=False, default="pending")  # pending / approved / returned
    reason = Column(Text, nullable=True)
    processed_by = Column(String(64), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    batch = relationship("Batch", back_populates="records")
    details = relationship("RecordDetail", back_populates="record", cascade="all, delete-orphan")
    logs = relationship("AuditLog", back_populates="record", cascade="all, delete-orphan")
    settlement_items = relationship("SettlementItem", back_populates="record", cascade="all, delete-orphan")


class RecordDetail(Base):
    __tablename__ = "record_details"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(Integer, ForeignKey("records.id"), nullable=False, index=True)
    field_key = Column(String(64), nullable=False)
    field_value = Column(Text, nullable=True)
    extra = Column(JSON, nullable=True)

    record = relationship("Record", back_populates="details")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True, index=True)
    record_id = Column(Integer, ForeignKey("records.id"), nullable=True, index=True)
    action = Column(String(32), nullable=False)  # create / process / return / export / approve
    detail = Column(Text, nullable=True)
    operator = Column(String(64), nullable=False)
    operated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    batch = relationship("Batch", back_populates="logs")
    record = relationship("Record", back_populates="logs")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    settlement_no = Column(String(64), unique=True, nullable=False, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    contract_id = Column(String(64), nullable=True, index=True)
    unit_name = Column(String(128), nullable=True, index=True)
    total_amount = Column(Float, nullable=False)
    status = Column(String(32), nullable=False, default="draft")  # draft / confirmed
    created_by = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed_by = Column(String(64), nullable=True)
    confirmed_at = Column(DateTime, nullable=True)

    items = relationship("SettlementItem", back_populates="settlement", cascade="all, delete-orphan")


class SettlementItem(Base):
    __tablename__ = "settlement_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    settlement_id = Column(Integer, ForeignKey("settlements.id"), nullable=False, index=True)
    record_id = Column(Integer, ForeignKey("records.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)

    settlement = relationship("Settlement", back_populates="items")
    record = relationship("Record", back_populates="settlement_items")
