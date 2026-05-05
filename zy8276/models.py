from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from database import Base
import enum
from datetime import datetime


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"
    FAILED = "failed"


class InventoryAction(str, enum.Enum):
    RESERVE = "reserve"
    DEDUCT = "deduct"
    ROLLBACK = "rollback"


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    price = Column(Float, nullable=False)
    total_stock = Column(Integer, default=0)
    available_stock = Column(Integer, default=0)
    frozen_stock = Column(Integer, default=0)
    sold_stock = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    orders = relationship("Order", back_populates="product")
    inventory_journals = relationship("InventoryJournal", back_populates="product")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    user_id = Column(String(100), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING, nullable=False)
    idempotency_key = Column(String(100), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="orders")
    idempotency = relationship("IdempotencyKey", back_populates="order", uselist=False)
    inventory_journals = relationship("InventoryJournal", back_populates="order")


class InventoryJournal(Base):
    __tablename__ = "inventory_journals"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    action = Column(Enum(InventoryAction), nullable=False)
    quantity = Column(Integer, nullable=False)
    before_available = Column(Integer, nullable=False)
    after_available = Column(Integer, nullable=False)
    before_frozen = Column(Integer, nullable=False)
    after_frozen = Column(Integer, nullable=False)
    before_sold = Column(Integer, nullable=False)
    after_sold = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="inventory_journals")
    order = relationship("Order", back_populates="inventory_journals")


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    status = Column(String(50), nullable=False)
    response = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    order = relationship("Order", back_populates="idempotency")
