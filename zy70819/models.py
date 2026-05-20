from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class ClassificationType(str, enum.Enum):
    NORMAL = "正常"
    PENDING_SUPPLEMENT = "待补充"
    BLOCKED = "已拦截"


class BatchStatus(str, enum.Enum):
    PROCESSED = "已处理"
    PENDING = "待处理"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(100), unique=True, index=True, nullable=False)
    submitted_by = Column(String(100), nullable=False)
    submit_time = Column(DateTime(timezone=True), server_default=func.now())
    total_items = Column(Integer, default=0)
    status = Column(Enum(BatchStatus), default=BatchStatus.PROCESSED)

    items = relationship("BatchItem", back_populates="batch", cascade="all, delete-orphan")


class BatchItem(Base):
    __tablename__ = "batch_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    material_code = Column(String(50), nullable=False, index=True)
    material_name = Column(String(200), nullable=False)
    specification = Column(String(200))
    manufacturer = Column(String(200))
    batch_no = Column(String(100), nullable=False)
    production_date = Column(DateTime)
    expiry_date = Column(DateTime, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit = Column(String(20))
    storage_condition = Column(String(200))
    supplier = Column(String(200))

    classification = Column(Enum(ClassificationType), nullable=False)
    reason = Column(Text)
    follow_up_action = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch", back_populates="items")
    change_history = relationship("ChangeHistory", back_populates="item", cascade="all, delete-orphan")


class ChangeHistory(Base):
    __tablename__ = "change_history"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("batch_items.id"))
    changed_by = Column(String(100), nullable=False)
    change_time = Column(DateTime(timezone=True), server_default=func.now())
    old_classification = Column(Enum(ClassificationType))
    new_classification = Column(Enum(ClassificationType))
    old_reason = Column(Text)
    new_reason = Column(Text)
    old_follow_up_action = Column(Text)
    new_follow_up_action = Column(Text)
    change_reason = Column(Text, nullable=False)

    item = relationship("BatchItem", back_populates="change_history")
