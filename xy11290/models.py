from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class MaterialType(str, enum.Enum):
    TRUSS = "桁架"
    LIGHT = "灯具"
    SCREEN = "屏幕"
    OTHER = "其他"


class MaterialStatus(str, enum.Enum):
    IN_STOCK = "在库"
    ALLOCATED = "已调拨"
    IN_USE = "使用中"
    RETURNED = "已归还"
    DAMAGED = "已损坏"
    LOST = "已丢失"


class TransferStatus(str, enum.Enum):
    PENDING = "待处理"
    APPROVED = "已批准"
    IN_PROGRESS = "进行中"
    COMPLETED = "已完成"
    CANCELLED = "已取消"


class RecordSource(str, enum.Enum):
    CSV = "CSV导入"
    YAML = "YAML导入"
    MANUAL = "手动录入"
    API = "API接口"


class Booth(Base):
    __tablename__ = "booths"

    id = Column(Integer, primary_key=True, index=True)
    booth_number = Column(String, unique=True, index=True, nullable=False)
    company_name = Column(String)
    contact_person = Column(String)
    contact_phone = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    allocations = relationship("Allocation", back_populates="booth")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    type = Column(Enum(MaterialType), nullable=False)
    specification = Column(String)
    quantity_total = Column(Integer, nullable=False, default=0)
    quantity_available = Column(Integer, nullable=False, default=0)
    unit = Column(String, default="件")
    location = Column(String)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    allocations = relationship("Allocation", back_populates="material")
    return_records = relationship("ReturnRecord", back_populates="material")
    loss_records = relationship("LossRecord", back_populates="material")
    inventory_logs = relationship("InventoryLog", back_populates="material")


class Allocation(Base):
    __tablename__ = "allocations"

    id = Column(Integer, primary_key=True, index=True)
    allocation_code = Column(String, unique=True, index=True, nullable=False)
    booth_id = Column(Integer, ForeignKey("booths.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(Enum(MaterialStatus), default=MaterialStatus.ALLOCATED)
    transfer_order_code = Column(String, index=True)
    operator = Column(String)
    remark = Column(Text)
    allocated_at = Column(DateTime(timezone=True), server_default=func.now())
    returned_at = Column(DateTime(timezone=True))

    booth = relationship("Booth", back_populates="allocations")
    material = relationship("Material", back_populates="allocations")


class TransferOrder(Base):
    __tablename__ = "transfer_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String, unique=True, index=True, nullable=False)
    source_location = Column(String)
    target_location = Column(String)
    status = Column(Enum(TransferStatus), default=TransferStatus.PENDING)
    operator = Column(String)
    approver = Column(String)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    items = relationship("TransferItem", back_populates="order")


class TransferItem(Base):
    __tablename__ = "transfer_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("transfer_orders.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    actual_quantity = Column(Integer)

    order = relationship("TransferOrder", back_populates="items")


class ReturnRecord(Base):
    __tablename__ = "return_records"

    id = Column(Integer, primary_key=True, index=True)
    record_code = Column(String, unique=True, index=True, nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    booth_id = Column(Integer, ForeignKey("booths.id"))
    allocation_id = Column(Integer, ForeignKey("allocations.id"))
    quantity_returned = Column(Integer, nullable=False)
    quantity_damaged = Column(Integer, default=0)
    operator = Column(String)
    remark = Column(Text)
    returned_at = Column(DateTime(timezone=True), server_default=func.now())

    material = relationship("Material", back_populates="return_records")


class LossRecord(Base):
    __tablename__ = "loss_records"

    id = Column(Integer, primary_key=True, index=True)
    record_code = Column(String, unique=True, index=True, nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity_lost = Column(Integer, nullable=False)
    quantity_damaged = Column(Integer, default=0)
    reason = Column(String)
    responsible_person = Column(String)
    operator = Column(String)
    remark = Column(Text)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    material = relationship("Material", back_populates="loss_records")


class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    change_type = Column(String, nullable=False)
    quantity_before = Column(Integer, nullable=False)
    quantity_change = Column(Integer, nullable=False)
    quantity_after = Column(Integer, nullable=False)
    operator = Column(String)
    remark = Column(Text)
    source = Column(Enum(RecordSource))
    related_record_code = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    material = relationship("Material", back_populates="inventory_logs")


class ImportErrorRecord(Base):
    __tablename__ = "import_error_records"

    id = Column(Integer, primary_key=True, index=True)
    import_batch = Column(String, index=True, nullable=False)
    source_type = Column(Enum(RecordSource), nullable=False)
    row_number = Column(Integer)
    original_data = Column(Text, nullable=False)
    error_message = Column(String, nullable=False)
    suggestion = Column(String)
    resolved = Column(Integer, default=0)
    resolved_by = Column(String)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
