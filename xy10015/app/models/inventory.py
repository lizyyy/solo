from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric, DateTime, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Inventory(BaseModel):
    __tablename__ = "inventories"

    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=0)
    reserved_quantity = Column(Integer, nullable=False, default=0)
    available_quantity = Column(Integer, nullable=False, default=0)
    cost_price = Column(Numeric(12, 2), nullable=False, default=0)
    sale_price = Column(Numeric(12, 2), nullable=False, default=0)
    last_adjusted_at = Column(DateTime, nullable=True)
    last_adjusted_by = Column(Integer, nullable=True)

    store = relationship("Store", back_populates="inventories")
    product = relationship("Product", back_populates="inventories")


class PriceChange(BaseModel):
    __tablename__ = "price_changes"

    code = Column(String(50), unique=True, nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    old_cost_price = Column(Numeric(12, 2), nullable=False)
    new_cost_price = Column(Numeric(12, 2), nullable=False)
    old_sale_price = Column(Numeric(12, 2), nullable=False)
    new_sale_price = Column(Numeric(12, 2), nullable=False)
    reason = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)
    error_message = Column(Text, nullable=True)
    executed_at = Column(DateTime, nullable=True)
    effective_date = Column(DateTime, nullable=True)

    product = relationship("Product", back_populates="price_changes")
    history = relationship("PriceChangeHistory", back_populates="price_change", cascade="all, delete-orphan")


class PriceChangeHistory(BaseModel):
    __tablename__ = "price_change_history"

    price_change_id = Column(Integer, ForeignKey("price_changes.id"), nullable=False, index=True)
    from_status = Column(String(20), nullable=True)
    to_status = Column(String(20), nullable=False)
    action = Column(String(50), nullable=False)
    note = Column(String(500), nullable=True)

    price_change = relationship("PriceChange", back_populates="history")


class InventoryTransfer(BaseModel):
    __tablename__ = "inventory_transfers"

    code = Column(String(50), unique=True, nullable=False, index=True)
    source_store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    target_store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    total_quantity = Column(Integer, nullable=False, default=0)
    reason = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)
    error_message = Column(Text, nullable=True)
    executed_at = Column(DateTime, nullable=True)
    expected_arrival_date = Column(DateTime, nullable=True)
    compensating_transfer_id = Column(Integer, ForeignKey("inventory_transfers.id"), nullable=True)
    is_compensating = Column(Boolean, default=False, nullable=False)

    source_store = relationship("Store", back_populates="source_transfers", foreign_keys=[source_store_id])
    target_store = relationship("Store", back_populates="target_transfers", foreign_keys=[target_store_id])
    items = relationship("InventoryTransferItem", back_populates="transfer", cascade="all, delete-orphan")
    history = relationship("InventoryTransferHistory", back_populates="transfer", cascade="all, delete-orphan")


class InventoryTransferItem(BaseModel):
    __tablename__ = "inventory_transfer_items"

    transfer_id = Column(Integer, ForeignKey("inventory_transfers.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    source_quantity_before = Column(Integer, nullable=True)
    source_quantity_after = Column(Integer, nullable=True)
    target_quantity_before = Column(Integer, nullable=True)
    target_quantity_after = Column(Integer, nullable=True)

    transfer = relationship("InventoryTransfer", back_populates="items")


class InventoryTransferHistory(BaseModel):
    __tablename__ = "inventory_transfer_history"

    transfer_id = Column(Integer, ForeignKey("inventory_transfers.id"), nullable=False, index=True)
    from_status = Column(String(20), nullable=True)
    to_status = Column(String(20), nullable=False)
    action = Column(String(50), nullable=False)
    note = Column(String(500), nullable=True)

    transfer = relationship("InventoryTransfer", back_populates="history")


class InventoryAdjustment(BaseModel):
    __tablename__ = "inventory_adjustments"

    code = Column(String(50), unique=True, nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    old_quantity = Column(Integer, nullable=False)
    new_quantity = Column(Integer, nullable=False)
    adjustment_type = Column(String(20), nullable=False)
    reason = Column(String(500), nullable=True)
    reference = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="completed", index=True)


class InventoryHistory(BaseModel):
    __tablename__ = "inventory_history"

    inventory_id = Column(Integer, ForeignKey("inventories.id"), nullable=False, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    old_quantity = Column(Integer, nullable=False)
    new_quantity = Column(Integer, nullable=False)
    old_cost_price = Column(Numeric(12, 2), nullable=True)
    new_cost_price = Column(Numeric(12, 2), nullable=True)
    old_sale_price = Column(Numeric(12, 2), nullable=True)
    new_sale_price = Column(Numeric(12, 2), nullable=True)
    change_type = Column(String(50), nullable=False)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)
    note = Column(String(500), nullable=True)
