from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    MATERIALS_OUT = "materials_out"
    RETURNING = "returning"
    COMPENSATING = "compensating"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ReturnStatus(str, enum.Enum):
    NOT_RETURNED = "not_returned"
    PARTIAL = "partial"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    COMPLETED = "completed"
    REJECTED = "rejected"


class CompensationStatus(str, enum.Enum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PAID = "paid"
    WAIVED = "waived"
    DISPUTED = "disputed"
    RESOLVED = "resolved"


class DamageType(str, enum.Enum):
    NONE = "none"
    LOST = "lost"
    DAMAGED = "damaged"
    PARTIAL_DAMAGE = "partial_damage"


class MaterialCategory(str, enum.Enum):
    FLOWER_STAND = "flower_stand"
    LIGHT_STRING = "light_string"
    TABLE_CARD = "table_card"
    OTHER = "other"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True)
    customer_name = Column(String)
    customer_phone = Column(String)
    event_date = Column(DateTime)
    event_location = Column(String)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    total_materials = Column(Integer, default=0)
    total_compensation = Column(Float, default=0.0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    notes = Column(Text, nullable=True)

    materials = relationship("Material", back_populates="order")
    outbounds = relationship("Outbound", back_populates="order")
    returns = relationship("Return", back_populates="order")
    compensations = relationship("Compensation", back_populates="order")
    reports = relationship("Report", back_populates="order")
    exceptions = relationship("ProcessingException", back_populates="order")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    name = Column(String)
    category = Column(Enum(MaterialCategory))
    quantity = Column(Integer)
    unit_price = Column(Float)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    order = relationship("Order", back_populates="materials")
    outbound_items = relationship("OutboundItem", back_populates="material")
    return_items = relationship("ReturnItem", back_populates="material")


class Outbound(Base):
    __tablename__ = "outbounds"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    outbound_no = Column(String, unique=True, index=True)
    outbound_time = Column(DateTime, server_default=func.now())
    operator = Column(String)
    notes = Column(Text, nullable=True)

    order = relationship("Order", back_populates="outbounds")
    items = relationship("OutboundItem", back_populates="outbound")


class OutboundItem(Base):
    __tablename__ = "outbound_items"

    id = Column(Integer, primary_key=True, index=True)
    outbound_id = Column(Integer, ForeignKey("outbounds.id"))
    material_id = Column(Integer, ForeignKey("materials.id"))
    quantity = Column(Integer)

    outbound = relationship("Outbound", back_populates="items")
    material = relationship("Material", back_populates="outbound_items")


class Return(Base):
    __tablename__ = "returns"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    return_no = Column(String, unique=True, index=True)
    return_time = Column(DateTime, server_default=func.now())
    operator = Column(String)
    status = Column(Enum(ReturnStatus), default=ReturnStatus.NOT_RETURNED)
    notes = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)

    order = relationship("Order", back_populates="returns")
    items = relationship("ReturnItem", back_populates="return_record")


class ReturnItem(Base):
    __tablename__ = "return_items"

    id = Column(Integer, primary_key=True, index=True)
    return_id = Column(Integer, ForeignKey("returns.id"))
    material_id = Column(Integer, ForeignKey("materials.id"))
    expected_quantity = Column(Integer)
    returned_quantity = Column(Integer, default=0)
    damage_type = Column(Enum(DamageType), default=DamageType.NONE)
    damage_notes = Column(Text, nullable=True)

    return_record = relationship("Return", back_populates="items")
    material = relationship("Material", back_populates="return_items")


class Compensation(Base):
    __tablename__ = "compensations"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    compensation_no = Column(String, unique=True, index=True)
    return_id = Column(Integer, ForeignKey("returns.id"))
    material_id = Column(Integer, ForeignKey("materials.id"))
    status = Column(Enum(CompensationStatus), default=CompensationStatus.PENDING)
    damage_type = Column(Enum(DamageType))
    quantity = Column(Integer)
    unit_amount = Column(Float)
    total_amount = Column(Float)
    created_at = Column(DateTime, server_default=func.now())
    paid_at = Column(DateTime, nullable=True)
    paid_by = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    order = relationship("Order", back_populates="compensations")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    report_no = Column(String, unique=True, index=True)
    report_type = Column(String)
    generated_at = Column(DateTime, server_default=func.now())
    generated_by = Column(String)
    content = Column(Text)
    file_path = Column(String, nullable=True)

    order = relationship("Order", back_populates="reports")


class ProcessingException(Base):
    __tablename__ = "processing_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    exception_type = Column(String)
    operation = Column(String)
    original_input = Column(Text)
    error_message = Column(Text)
    processing_result = Column(Text)
    handled = Column(Boolean, default=False)
    handled_by = Column(String, nullable=True)
    handled_at = Column(DateTime, nullable=True)
    correction_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())