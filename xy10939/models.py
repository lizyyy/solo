from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class BatchStatus(str, enum.Enum):
    CREATED = "已创建"
    SORTING = "分拣中"
    SORTED = "已分拣"
    STERILIZING = "消毒中"
    STERILIZED = "已消毒"
    DONATING = "转赠中"
    COMPLETED = "已完成"
    EXCEPTION = "异常"


class ClothingStatus(str, enum.Enum):
    PENDING = "待分拣"
    SORTED = "已分类"
    STERILIZING = "消毒中"
    STERILIZED = "已消毒"
    READY = "待转赠"
    DONATED = "已转赠"
    REJECTED = "已淘汰"


class SterilizationMethod(str, enum.Enum):
    HIGH_TEMP = "高温消毒"
    UV = "紫外线消毒"
    CHEMICAL = "化学消毒"
    OZONE = "臭氧消毒"


class DonationBatch(Base):
    __tablename__ = "donation_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    donor_name = Column(String(100), nullable=False)
    donor_phone = Column(String(20))
    donor_address = Column(String(200))
    total_count = Column(Integer, nullable=False)
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(20), default=BatchStatus.CREATED)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    clothing_items = relationship("ClothingItem", back_populates="batch", cascade="all, delete-orphan")
    sorting_reports = relationship("SortingReport", back_populates="batch")


class ClothingCategory(Base):
    __tablename__ = "clothing_categories"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(50), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clothing_items = relationship("ClothingItem", back_populates="category")


class ClothingItem(Base):
    __tablename__ = "clothing_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("donation_batches.id"), nullable=False)
    item_no = Column(String(50), unique=True, index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("clothing_categories.id"))
    name = Column(String(100), nullable=False)
    brand = Column(String(50))
    color = Column(String(30))
    size = Column(String(20))
    material = Column(String(50))
    status = Column(String(20), default=ClothingStatus.PENDING)
    quality_level = Column(Integer)
    estimated_value = Column(Float)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("DonationBatch", back_populates="clothing_items")
    category = relationship("ClothingCategory", back_populates="clothing_items")
    sterilization_records = relationship("SterilizationRecord", back_populates="clothing_item")
    donation_records = relationship("DonationRecord", back_populates="clothing_item")
    rejection_records = relationship("RejectionRecord", back_populates="clothing_item")
    status_history = relationship("StatusHistory", back_populates="clothing_item", cascade="all, delete-orphan")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    clothing_item_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=False)
    from_status = Column(String(20))
    to_status = Column(String(20), nullable=False)
    operator = Column(String(50))
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clothing_item = relationship("ClothingItem", back_populates="status_history")


class SterilizationRecord(Base):
    __tablename__ = "sterilization_records"

    id = Column(Integer, primary_key=True, index=True)
    clothing_item_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=False)
    record_no = Column(String(50), unique=True, index=True, nullable=False)
    method = Column(String(30), nullable=False)
    temperature = Column(Float)
    duration = Column(Integer)
    operator = Column(String(50))
    result = Column(String(20), nullable=False)
    remark = Column(Text)
    sterilized_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clothing_item = relationship("ClothingItem", back_populates="sterilization_records")


class DonationOrganization(Base):
    __tablename__ = "donation_organizations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    contact_person = Column(String(50))
    contact_phone = Column(String(20))
    address = Column(String(200))
    description = Column(Text)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    donation_records = relationship("DonationRecord", back_populates="organization")


class DonationRecord(Base):
    __tablename__ = "donation_records"

    id = Column(Integer, primary_key=True, index=True)
    clothing_item_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=False)
    organization_id = Column(Integer, ForeignKey("donation_organizations.id"), nullable=False)
    record_no = Column(String(50), unique=True, index=True, nullable=False)
    operator = Column(String(50))
    receiver = Column(String(50))
    remark = Column(Text)
    donated_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clothing_item = relationship("ClothingItem", back_populates="donation_records")
    organization = relationship("DonationOrganization", back_populates="donation_records")


class RejectionReason(Base):
    __tablename__ = "rejection_reasons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Integer, default=1)

    rejection_records = relationship("RejectionRecord", back_populates="reason")


class RejectionRecord(Base):
    __tablename__ = "rejection_records"

    id = Column(Integer, primary_key=True, index=True)
    clothing_item_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=False)
    reason_id = Column(Integer, ForeignKey("rejection_reasons.id"), nullable=False)
    record_no = Column(String(50), unique=True, index=True, nullable=False)
    operator = Column(String(50))
    remark = Column(Text)
    rejected_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clothing_item = relationship("ClothingItem", back_populates="rejection_records")
    reason = relationship("RejectionReason", back_populates="rejection_records")


class SortingReport(Base):
    __tablename__ = "sorting_reports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("donation_batches.id"), nullable=False)
    report_no = Column(String(50), unique=True, index=True, nullable=False)
    total_count = Column(Integer, default=0)
    sorted_count = Column(Integer, default=0)
    sterilized_count = Column(Integer, default=0)
    donated_count = Column(Integer, default=0)
    rejected_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    summary = Column(Text)
    operator = Column(String(50))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("DonationBatch", back_populates="sorting_reports")


class ProcessingException(Base):
    __tablename__ = "processing_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    exception_no = Column(String(50), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("donation_batches.id"))
    clothing_item_id = Column(Integer, ForeignKey("clothing_items.id"))
    original_input = Column(Text, nullable=False)
    error_message = Column(Text)
    processing_step = Column(String(50))
    conclusion = Column(Text)
    operator = Column(String(50))
    resolved = Column(Integer, default=0)
    resolved_at = Column(DateTime(timezone=True))
    resolution_note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
