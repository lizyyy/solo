from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric, DateTime
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Store(BaseModel):
    __tablename__ = "stores"

    name = Column(String(100), nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    address = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    description = Column(String(500), nullable=True)

    users = relationship("User", back_populates="store", foreign_keys="User.store_id")
    inventories = relationship("Inventory", back_populates="store", cascade="all, delete-orphan")
    source_transfers = relationship("InventoryTransfer", back_populates="source_store", foreign_keys="InventoryTransfer.source_store_id")
    target_transfers = relationship("InventoryTransfer", back_populates="target_store", foreign_keys="InventoryTransfer.target_store_id")


class Product(BaseModel):
    __tablename__ = "products"

    name = Column(String(150), nullable=False, index=True)
    sku = Column(String(50), unique=True, nullable=False, index=True)
    barcode = Column(String(50), nullable=True, index=True)
    category = Column(String(100), nullable=True)
    unit = Column(String(20), nullable=False, default="件")
    default_cost = Column(Numeric(12, 2), nullable=False, default=0)
    default_sale_price = Column(Numeric(12, 2), nullable=False, default=0)
    min_stock = Column(Integer, nullable=True, default=0)
    max_stock = Column(Integer, nullable=True)
    description = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    inventories = relationship("Inventory", back_populates="product", cascade="all, delete-orphan")
    price_changes = relationship("PriceChange", back_populates="product", cascade="all, delete-orphan")
