from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from app.models.enums import LedgerStatus, DataSourceType, UserRole, LossType, RecordStatus


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    role = Column(Enum(UserRole), default=UserRole.SORTER)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    status_changes = relationship("StatusChangeHistory", back_populates="operator")


class LossLedger(Base):
    __tablename__ = "loss_ledgers"

    id = Column(Integer, primary_key=True, index=True)
    ledger_no = Column(String, index=True)
    supplier_id = Column(String, index=True)
    supplier_name = Column(String)
    batch_no = Column(String, index=True)
    product_name = Column(String)
    total_weight = Column(Float, default=0.0)
    loss_weight = Column(Float, default=0.0)
    loss_rate = Column(Float, default=0.0)
    loss_type = Column(Enum(LossType), default=LossType.OTHER)
    status = Column(Enum(LedgerStatus), default=LedgerStatus.DRAFT)
    current_version = Column(Integer, default=1)
    is_latest = Column(Boolean, default=True)
    parent_ledger_id = Column(Integer, ForeignKey("loss_ledgers.id"), nullable=True)
    remark = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    data_sources = relationship("DataSource", back_populates="ledger", cascade="all, delete-orphan")
    status_histories = relationship("StatusChangeHistory", back_populates="ledger", cascade="all, delete-orphan")
    loss_items = relationship("LossItem", back_populates="ledger", cascade="all, delete-orphan")
    versions = relationship("LossLedger", remote_side=[id])


class DataSource(Base):
    __tablename__ = "data_sources"

    id = Column(Integer, primary_key=True, index=True)
    ledger_id = Column(Integer, ForeignKey("loss_ledgers.id"))
    source_type = Column(Enum(DataSourceType), nullable=False)
    source_no = Column(String, index=True)
    source_data = Column(Text)
    file_url = Column(String, nullable=True)
    is_valid = Column(Boolean, default=True)
    validation_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ledger = relationship("LossLedger", back_populates="data_sources")


class StatusChangeHistory(Base):
    __tablename__ = "status_change_histories"

    id = Column(Integer, primary_key=True, index=True)
    ledger_id = Column(Integer, ForeignKey("loss_ledgers.id"))
    from_status = Column(Enum(LedgerStatus), nullable=True)
    to_status = Column(Enum(LedgerStatus), nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"))
    change_reason = Column(Text, nullable=False)
    change_time = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String, nullable=True)

    ledger = relationship("LossLedger", back_populates="status_histories")
    operator = relationship("User", back_populates="status_changes")


class LossItem(Base):
    __tablename__ = "loss_items"

    id = Column(Integer, primary_key=True, index=True)
    ledger_id = Column(Integer, ForeignKey("loss_ledgers.id"))
    item_no = Column(String, index=True)
    product_name = Column(String)
    weight = Column(Float, default=0.0)
    loss_reason = Column(String)
    record_status = Column(Enum(RecordStatus), default=RecordStatus.VALID)
    validation_errors = Column(Text, nullable=True)
    deduplication_key = Column(String, index=True)
    source_type = Column(Enum(DataSourceType))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ledger = relationship("LossLedger", back_populates="loss_items")


class FailedRecord(Base):
    __tablename__ = "failed_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, index=True)
    source_type = Column(Enum(DataSourceType))
    source_data = Column(Text)
    error_type = Column(String)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
